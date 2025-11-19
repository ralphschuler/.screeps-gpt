import { describe, expect, it } from "vitest";
import { DecisionTreeBuilder } from "../../src/DecisionTreeBuilder.js";
import {
  createSubtreeFactory,
  createCondition,
  andConditions,
  orConditions,
  notCondition,
  createSwitchCases,
  createPriorityTree,
  wrapWithCondition,
  createResultMapper
} from "../../src/composition.js";

describe("Composition utilities", () => {
  interface TestContext {
    value: number;
    flag: boolean;
    priority: string;
  }

  type TestResult = "A" | "B" | "C" | "D" | "IDLE";

  describe("createSubtreeFactory", () => {
    it("should create a parameterized subtree factory", () => {
      const createThresholdCheck = createSubtreeFactory<
        TestContext,
        TestResult,
        { threshold: number; highResult: TestResult; lowResult: TestResult }
      >(({ threshold, highResult, lowResult }) => {
        const builder = new DecisionTreeBuilder<TestContext, TestResult>();
        return builder.if(ctx => ctx.value > threshold, builder.leaf(highResult), builder.leaf(lowResult));
      });

      const builder = new DecisionTreeBuilder<TestContext, TestResult>();
      const subtree = createThresholdCheck({ threshold: 50, highResult: "A", lowResult: "B" });
      const tree = builder.build(subtree);

      expect(tree.evaluate({ value: 60, flag: false, priority: "" })).toBe("A");
      expect(tree.evaluate({ value: 40, flag: false, priority: "" })).toBe("B");
    });

    it("should create reusable subtrees with different parameters", () => {
      const createRangeCheck = createSubtreeFactory<
        TestContext,
        TestResult,
        { min: number; max: number; inRangeResult: TestResult; outRangeResult: TestResult }
      >(({ min, max, inRangeResult, outRangeResult }) => {
        const builder = new DecisionTreeBuilder<TestContext, TestResult>();
        return builder.if(
          ctx => ctx.value >= min && ctx.value <= max,
          builder.leaf(inRangeResult),
          builder.leaf(outRangeResult)
        );
      });

      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      const lowRange = createRangeCheck({ min: 0, max: 25, inRangeResult: "A", outRangeResult: "B" });
      const highRange = createRangeCheck({ min: 75, max: 100, inRangeResult: "C", outRangeResult: "D" });

      const tree1 = builder.build(lowRange);
      expect(tree1.evaluate({ value: 10, flag: false, priority: "" })).toBe("A");
      expect(tree1.evaluate({ value: 50, flag: false, priority: "" })).toBe("B");

      builder.reset();
      const tree2 = builder.build(highRange);
      expect(tree2.evaluate({ value: 80, flag: false, priority: "" })).toBe("C");
      expect(tree2.evaluate({ value: 50, flag: false, priority: "" })).toBe("D");
    });
  });

  describe("createCondition", () => {
    it("should create parameterized conditions", () => {
      const createThresholdCondition = createCondition<TestContext, { threshold: number }>(
        ({ threshold }) =>
          ctx =>
            ctx.value > threshold
      );

      const highThreshold = createThresholdCondition({ threshold: 75 });
      const lowThreshold = createThresholdCondition({ threshold: 25 });

      expect(highThreshold({ value: 80, flag: false, priority: "" })).toBe(true);
      expect(highThreshold({ value: 50, flag: false, priority: "" })).toBe(false);

      expect(lowThreshold({ value: 30, flag: false, priority: "" })).toBe(true);
      expect(lowThreshold({ value: 20, flag: false, priority: "" })).toBe(false);
    });

    it("should work with decision trees", () => {
      const createRangeCondition = createCondition<TestContext, { min: number; max: number }>(
        ({ min, max }) =>
          ctx =>
            ctx.value >= min && ctx.value <= max
      );

      const inRange = createRangeCondition({ min: 10, max: 20 });
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      const tree = builder.build(builder.if(inRange, builder.leaf("A"), builder.leaf("B")));

      expect(tree.evaluate({ value: 15, flag: false, priority: "" })).toBe("A");
      expect(tree.evaluate({ value: 5, flag: false, priority: "" })).toBe("B");
    });
  });

  describe("andConditions", () => {
    it("should combine conditions with AND logic", () => {
      const condition = andConditions<TestContext>(
        ctx => ctx.value > 10,
        ctx => ctx.flag === true
      );

      expect(condition({ value: 15, flag: true, priority: "" })).toBe(true);
      expect(condition({ value: 15, flag: false, priority: "" })).toBe(false);
      expect(condition({ value: 5, flag: true, priority: "" })).toBe(false);
      expect(condition({ value: 5, flag: false, priority: "" })).toBe(false);
    });

    it("should work with multiple conditions", () => {
      const condition = andConditions<TestContext>(
        ctx => ctx.value > 10,
        ctx => ctx.value < 50,
        ctx => ctx.flag === true
      );

      expect(condition({ value: 30, flag: true, priority: "" })).toBe(true);
      expect(condition({ value: 60, flag: true, priority: "" })).toBe(false);
    });

    it("should work in decision trees", () => {
      const condition = andConditions<TestContext>(
        ctx => ctx.value > 10,
        ctx => ctx.flag === true
      );

      const builder = new DecisionTreeBuilder<TestContext, TestResult>();
      const tree = builder.build(builder.if(condition, builder.leaf("A"), builder.leaf("B")));

      expect(tree.evaluate({ value: 15, flag: true, priority: "" })).toBe("A");
      expect(tree.evaluate({ value: 5, flag: true, priority: "" })).toBe("B");
    });
  });

  describe("orConditions", () => {
    it("should combine conditions with OR logic", () => {
      const condition = orConditions<TestContext>(
        ctx => ctx.value > 50,
        ctx => ctx.flag === true
      );

      expect(condition({ value: 60, flag: false, priority: "" })).toBe(true);
      expect(condition({ value: 10, flag: true, priority: "" })).toBe(true);
      expect(condition({ value: 60, flag: true, priority: "" })).toBe(true);
      expect(condition({ value: 10, flag: false, priority: "" })).toBe(false);
    });

    it("should work with multiple conditions", () => {
      const condition = orConditions<TestContext>(
        ctx => ctx.value < 10,
        ctx => ctx.value > 90,
        ctx => ctx.flag === true
      );

      expect(condition({ value: 5, flag: false, priority: "" })).toBe(true);
      expect(condition({ value: 95, flag: false, priority: "" })).toBe(true);
      expect(condition({ value: 50, flag: true, priority: "" })).toBe(true);
      expect(condition({ value: 50, flag: false, priority: "" })).toBe(false);
    });
  });

  describe("notCondition", () => {
    it("should negate a condition", () => {
      const isHigh = (ctx: TestContext) => ctx.value > 50;
      const isNotHigh = notCondition(isHigh);

      expect(isNotHigh({ value: 60, flag: false, priority: "" })).toBe(false);
      expect(isNotHigh({ value: 40, flag: false, priority: "" })).toBe(true);
    });

    it("should work in decision trees", () => {
      const isLow = (ctx: TestContext) => ctx.value < 10;
      const isNotLow = notCondition(isLow);

      const builder = new DecisionTreeBuilder<TestContext, TestResult>();
      const tree = builder.build(builder.if(isNotLow, builder.leaf("A"), builder.leaf("B")));

      expect(tree.evaluate({ value: 5, flag: false, priority: "" })).toBe("B");
      expect(tree.evaluate({ value: 50, flag: false, priority: "" })).toBe("A");
    });
  });

  describe("Complex condition combinations", () => {
    it("should combine AND, OR, and NOT", () => {
      const condition = orConditions(
        andConditions<TestContext>(
          ctx => ctx.value > 10,
          ctx => ctx.value < 50
        ),
        andConditions<TestContext>(
          ctx => ctx.flag === true,
          notCondition(ctx => ctx.priority === "low")
        )
      );

      expect(condition({ value: 30, flag: false, priority: "" })).toBe(true);
      expect(condition({ value: 60, flag: true, priority: "high" })).toBe(true);
      expect(condition({ value: 60, flag: true, priority: "low" })).toBe(false);
      expect(condition({ value: 60, flag: false, priority: "" })).toBe(false);
    });
  });

  describe("createSwitchCases", () => {
    it("should create a switch-case subtree", () => {
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      const switchTree = createSwitchCases(
        builder,
        [
          { condition: ctx => ctx.value < 10, result: "A" },
          { condition: ctx => ctx.value < 50, result: "B" },
          { condition: ctx => ctx.value < 90, result: "C" }
        ],
        "D"
      );

      const tree = builder.build(switchTree);

      expect(tree.evaluate({ value: 5, flag: false, priority: "" })).toBe("A");
      expect(tree.evaluate({ value: 30, flag: false, priority: "" })).toBe("B");
      expect(tree.evaluate({ value: 70, flag: false, priority: "" })).toBe("C");
      expect(tree.evaluate({ value: 95, flag: false, priority: "" })).toBe("D");
    });

    it("should work with complex conditions", () => {
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      const switchTree = createSwitchCases(
        builder,
        [
          {
            condition: andConditions<TestContext>(
              ctx => ctx.value > 50,
              ctx => ctx.flag === true
            ),
            result: "A"
          },
          { condition: ctx => ctx.value > 50, result: "B" },
          { condition: ctx => ctx.flag === true, result: "C" }
        ],
        "D"
      );

      const tree = builder.build(switchTree);

      expect(tree.evaluate({ value: 60, flag: true, priority: "" })).toBe("A");
      expect(tree.evaluate({ value: 60, flag: false, priority: "" })).toBe("B");
      expect(tree.evaluate({ value: 10, flag: true, priority: "" })).toBe("C");
      expect(tree.evaluate({ value: 10, flag: false, priority: "" })).toBe("D");
    });
  });

  describe("createPriorityTree", () => {
    it("should create a priority-based tree", () => {
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      const priorityTree = createPriorityTree(
        builder,
        [
          { condition: ctx => ctx.priority === "critical", result: "A" },
          { condition: ctx => ctx.priority === "high", result: "B" },
          { condition: ctx => ctx.priority === "medium", result: "C" }
        ],
        "D"
      );

      const tree = builder.build(priorityTree);

      expect(tree.evaluate({ value: 0, flag: false, priority: "critical" })).toBe("A");
      expect(tree.evaluate({ value: 0, flag: false, priority: "high" })).toBe("B");
      expect(tree.evaluate({ value: 0, flag: false, priority: "medium" })).toBe("C");
      expect(tree.evaluate({ value: 0, flag: false, priority: "low" })).toBe("D");
    });

    it("should evaluate conditions in order", () => {
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      const priorityTree = createPriorityTree(
        builder,
        [
          { condition: ctx => ctx.value > 0, result: "A" }, // Matches first
          { condition: ctx => ctx.value > 10, result: "B" }, // Would also match but comes later
          { condition: ctx => ctx.value > 20, result: "C" }
        ],
        "D"
      );

      const tree = builder.build(priorityTree);

      expect(tree.evaluate({ value: 30, flag: false, priority: "" })).toBe("A"); // First match wins
    });
  });

  describe("wrapWithCondition", () => {
    it("should wrap a subtree with a condition", () => {
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      const complexSubtree = builder.switch(
        [
          { condition: ctx => ctx.value < 25, node: builder.leaf("A") },
          { condition: ctx => ctx.value < 75, node: builder.leaf("B") }
        ],
        builder.leaf("C")
      );

      const wrapped = wrapWithCondition(builder, ctx => ctx.flag === true, complexSubtree, "IDLE");

      const tree = builder.build(wrapped);

      expect(tree.evaluate({ value: 20, flag: true, priority: "" })).toBe("A");
      expect(tree.evaluate({ value: 50, flag: true, priority: "" })).toBe("B");
      expect(tree.evaluate({ value: 80, flag: true, priority: "" })).toBe("C");
      expect(tree.evaluate({ value: 20, flag: false, priority: "" })).toBe("IDLE");
    });

    it("should enable conditional subtree execution", () => {
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();

      // Complex logic only when enabled
      const expensiveLogic = builder.if(ctx => ctx.value > 50, builder.leaf("A"), builder.leaf("B"));

      const wrapped = wrapWithCondition(builder, ctx => ctx.priority === "high", expensiveLogic, "IDLE");

      const tree = builder.build(wrapped);

      expect(tree.evaluate({ value: 60, flag: false, priority: "high" })).toBe("A");
      expect(tree.evaluate({ value: 60, flag: false, priority: "low" })).toBe("IDLE");
    });
  });

  describe("createResultMapper", () => {
    it("should create a result mapper function", () => {
      const mapper = createResultMapper<TestContext, TestResult>(ctx => {
        if (ctx.value > 75) return "A";
        if (ctx.value > 50) return "B";
        if (ctx.value > 25) return "C";
        return "D";
      });

      expect(mapper({ value: 80, flag: false, priority: "" })).toBe("A");
      expect(mapper({ value: 60, flag: false, priority: "" })).toBe("B");
      expect(mapper({ value: 40, flag: false, priority: "" })).toBe("C");
      expect(mapper({ value: 10, flag: false, priority: "" })).toBe("D");
    });

    it("should enable consistent result generation", () => {
      const createActionMapper = createResultMapper<TestContext, TestResult>(ctx => {
        if (ctx.priority === "critical") return "A";
        if (ctx.flag) return "B";
        return "C";
      });

      expect(createActionMapper({ value: 0, flag: false, priority: "critical" })).toBe("A");
      expect(createActionMapper({ value: 0, flag: true, priority: "low" })).toBe("B");
      expect(createActionMapper({ value: 0, flag: false, priority: "low" })).toBe("C");
    });
  });

  describe("Real-world composition scenarios", () => {
    it("should compose a complex creep decision tree with reusable parts", () => {
      // Create reusable energy check subtree
      const createEnergyCheck = createSubtreeFactory<
        TestContext,
        TestResult,
        { fullAction: TestResult; emptyAction: TestResult }
      >(({ fullAction, emptyAction }) => {
        const builder = new DecisionTreeBuilder<TestContext, TestResult>();
        return builder.if(ctx => ctx.value > 0, builder.leaf(fullAction), builder.leaf(emptyAction));
      });

      // Create priority check condition
      const isHighPriority = createCondition<TestContext, Record<string, never>>(() => ctx => ctx.priority === "high")(
        {}
      );

      // Compose the tree
      const builder = new DecisionTreeBuilder<TestContext, TestResult>();
      const energySubtree = createEnergyCheck({ fullAction: "A", emptyAction: "B" });

      const tree = builder.build(wrapWithCondition(builder, isHighPriority, energySubtree, "IDLE"));

      expect(tree.evaluate({ value: 10, flag: false, priority: "high" })).toBe("A");
      expect(tree.evaluate({ value: 0, flag: false, priority: "high" })).toBe("B");
      expect(tree.evaluate({ value: 10, flag: false, priority: "low" })).toBe("IDLE");
    });

    it("should create role-specific trees with factories", () => {
      const createRoleTree = createSubtreeFactory<
        TestContext,
        TestResult,
        { thresholds: number[]; results: TestResult[] }
      >(({ thresholds, results }) => {
        const builder = new DecisionTreeBuilder<TestContext, TestResult>();
        const cases = thresholds.map((threshold, i) => ({
          condition: (ctx: TestContext) => ctx.value < threshold,
          result: results[i]
        }));
        return createSwitchCases(builder, cases, results[results.length - 1]);
      });

      const harvesterTree = createRoleTree({
        thresholds: [25, 75],
        results: ["A", "B", "C"]
      });

      const builderTree = createRoleTree({
        thresholds: [50],
        results: ["A", "B"]
      });

      const builder1 = new DecisionTreeBuilder<TestContext, TestResult>();
      const tree1 = builder1.build(harvesterTree);
      expect(tree1.evaluate({ value: 20, flag: false, priority: "" })).toBe("A");
      expect(tree1.evaluate({ value: 50, flag: false, priority: "" })).toBe("B");
      expect(tree1.evaluate({ value: 80, flag: false, priority: "" })).toBe("C");

      const builder2 = new DecisionTreeBuilder<TestContext, TestResult>();
      const tree2 = builder2.build(builderTree);
      expect(tree2.evaluate({ value: 40, flag: false, priority: "" })).toBe("A");
      expect(tree2.evaluate({ value: 60, flag: false, priority: "" })).toBe("B");
    });
  });
});
