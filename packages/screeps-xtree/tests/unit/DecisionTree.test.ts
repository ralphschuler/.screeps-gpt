import { describe, it, expect, beforeEach } from "vitest";
import { DecisionTreeBuilder, DecisionTreeError } from "../../src/index.js";

describe("DecisionTree", () => {
  interface TestContext {
    value: number;
    flag: boolean;
  }

  type TestResult = "A" | "B" | "C" | "D";

  let builder: DecisionTreeBuilder<TestContext, TestResult>;

  beforeEach(() => {
    // Reset builder for each test to ensure clean state
    builder = new DecisionTreeBuilder<TestContext, TestResult>();
  });

  describe("Leaf nodes", () => {
    it("should return result from a leaf node", () => {
      const tree = builder.build(builder.leaf("A"));

      const result = tree.evaluate({ value: 0, flag: false });
      expect(result).toBe("A");
    });
  });

  describe("If nodes", () => {
    it("should follow true branch when condition is true", () => {
      const tree = builder.build(builder.if(ctx => ctx.value > 5, builder.leaf("A"), builder.leaf("B")));

      const result = tree.evaluate({ value: 10, flag: false });
      expect(result).toBe("A");
    });

    it("should follow false branch when condition is false", () => {
      const tree = builder.build(builder.if(ctx => ctx.value > 5, builder.leaf("A"), builder.leaf("B")));

      const result = tree.evaluate({ value: 3, flag: false });
      expect(result).toBe("B");
    });

    it("should handle nested if nodes", () => {
      const tree = builder.build(
        builder.if(
          ctx => ctx.value > 5,
          builder.if(ctx => ctx.flag, builder.leaf("A"), builder.leaf("B")),
          builder.if(ctx => ctx.flag, builder.leaf("C"), builder.leaf("D"))
        )
      );

      expect(tree.evaluate({ value: 10, flag: true })).toBe("A");
      expect(tree.evaluate({ value: 10, flag: false })).toBe("B");
      expect(tree.evaluate({ value: 3, flag: true })).toBe("C");
      expect(tree.evaluate({ value: 3, flag: false })).toBe("D");
    });
  });

  describe("Switch nodes", () => {
    it("should follow first matching case", () => {
      const tree = builder.build(
        builder.switch([
          { condition: ctx => ctx.value < 0, node: builder.leaf("A") },
          { condition: ctx => ctx.value < 10, node: builder.leaf("B") },
          { condition: ctx => ctx.value < 100, node: builder.leaf("C") }
        ])
      );

      expect(tree.evaluate({ value: -5, flag: false })).toBe("A");
      expect(tree.evaluate({ value: 5, flag: false })).toBe("B");
      expect(tree.evaluate({ value: 50, flag: false })).toBe("C");
    });

    it("should use default node when no cases match", () => {
      const tree = builder.build(
        builder.switch(
          [
            { condition: ctx => ctx.value < 0, node: builder.leaf("A") },
            { condition: ctx => ctx.value < 10, node: builder.leaf("B") }
          ],
          builder.leaf("D")
        )
      );

      const result = tree.evaluate({ value: 100, flag: false });
      expect(result).toBe("D");
    });

    it("should throw error when no cases match and no default", () => {
      const tree = builder.build(builder.switch([{ condition: ctx => ctx.value < 0, node: builder.leaf("A") }]));

      expect(() => tree.evaluate({ value: 10, flag: false })).toThrow(DecisionTreeError);
    });

    it("should handle empty cases array with default", () => {
      const tree = builder.build(builder.switch([], builder.leaf("D")));

      const result = tree.evaluate({ value: 0, flag: false });
      expect(result).toBe("D");
    });
  });

  describe("Noop nodes", () => {
    it("should pass through to next node", () => {
      const tree = builder.build(builder.noop(builder.leaf("A")));

      const result = tree.evaluate({ value: 0, flag: false });
      expect(result).toBe("A");
    });

    it("should chain multiple noop nodes", () => {
      const tree = builder.build(builder.noop(builder.noop(builder.noop(builder.leaf("A")))));

      const result = tree.evaluate({ value: 0, flag: false });
      expect(result).toBe("A");
    });

    it("should support labels for debugging", () => {
      const node = builder.noop(builder.leaf("A"), "debug-point");
      expect(node.type).toBe("noop");
      expect(node.label).toBe("debug-point");
    });
  });

  describe("Complex trees", () => {
    it("should handle mixed node types", () => {
      const tree = builder.build(
        builder.if(
          ctx => ctx.flag,
          builder.switch(
            [
              { condition: ctx => ctx.value < 5, node: builder.leaf("A") },
              { condition: ctx => ctx.value < 10, node: builder.leaf("B") }
            ],
            builder.leaf("C")
          ),
          builder.noop(builder.leaf("D"))
        )
      );

      expect(tree.evaluate({ value: 3, flag: true })).toBe("A");
      expect(tree.evaluate({ value: 7, flag: true })).toBe("B");
      expect(tree.evaluate({ value: 15, flag: true })).toBe("C");
      expect(tree.evaluate({ value: 100, flag: false })).toBe("D");
    });
  });

  describe("Error handling", () => {
    it("should include node ID in error message", () => {
      const switchNode = builder.switch([{ condition: () => false, node: builder.leaf("A") }]);
      const tree = builder.build(switchNode);

      try {
        tree.evaluate({ value: 0, flag: false });
        expect.fail("Should have thrown an error");
      } catch (error) {
        expect(error).toBeInstanceOf(DecisionTreeError);
        if (error instanceof DecisionTreeError) {
          expect(error.message).toContain(switchNode.id);
          expect(error.nodeId).toBe(switchNode.id);
        }
      }
    });
  });

  describe("Builder", () => {
    it("should generate unique IDs for each node type", () => {
      const ifNode = builder.if(() => true, builder.leaf("A"), builder.leaf("B"));
      const switchNode = builder.switch([]);
      const leafNode = builder.leaf("C");
      const noopNode = builder.noop(builder.leaf("D"));

      expect(ifNode.id).toMatch(/^if-\d+$/);
      expect(switchNode.id).toMatch(/^switch-\d+$/);
      expect(leafNode.id).toMatch(/^leaf-\d+$/);
      expect(noopNode.id).toMatch(/^noop-\d+$/);
    });

    it("should reset counter when reset is called", () => {
      builder.leaf("A");
      builder.leaf("B");
      expect(builder.leaf("C").id).toBe("leaf-2");

      builder.reset();
      expect(builder.leaf("D").id).toBe("leaf-0");
    });

    it("should allow accessing root node", () => {
      const root = builder.leaf("A");
      const tree = builder.build(root);

      expect(tree.getRoot()).toBe(root);
    });
  });
});
