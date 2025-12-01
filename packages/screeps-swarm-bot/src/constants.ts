/** Default TTL for room pheromone refreshes. */
export const ROOM_MEMORY_TTL = 50;

/** Interval for overmind reassessment. */
export const OVERMIND_INTERVAL = 20;

/** Pheromone decay applied per refresh cycle. */
export const PHEROMONE_DECAY = 0.9;

/** Pheromone diffusion percentage to neighboring owned rooms. */
export const PHEROMONE_DIFFUSION = 0.1;

/** Maximum length for the event ring buffer. */
export const MAX_EVENT_LOG = 20;

/** Danger thresholds aligned with the design doc. */
export const DANGER_THRESHOLDS = {
  hostileSeen: 1,
  underAttack: 2,
  nuked: 3
};

/** Minimum expand weight needed to enter the global claim queue. */
export const MIN_EXPAND_SIGNAL = 8;

/** Threshold for war escalation. */
export const WAR_ESCALATION_THRESHOLD = 5;

/** How often to reevaluate spawn roulette tables (ticks). */
export const SPAWN_PROFILE_TTL = 10;

/** Minimum nuke score to consider launching. */
export const NUKE_SCORE_THRESHOLD = 35;

/** Power creep cadence (ticks). */
export const POWER_LOOP_INTERVAL = 10;

/** Inter-shard meta update cadence. */
export const SHARD_META_INTERVAL = 100;

/** Energy reserve to keep when spawning to avoid starving logistics. */
export const SPAWN_ENERGY_RESERVE = 150;

/** Maximum creeps per role multiplier to keep swarm sizes bounded. */
export const ROLE_CAP_MULTIPLIER = 0.4;

/** Energy threshold to classify a room as surplus for inter-room hauling. */
export const LOGISTICS_SURPLUS = 40000;

/** Energy threshold to classify a room as deficit for inter-room hauling. */
export const LOGISTICS_DEFICIT = 20000;

/** Maximum number of concurrent logistics routes. */
export const MAX_LOGISTICS_ROUTES = 3;

/** Minimum war pheromone before staging war/raid rallies. */
export const RALLY_WAR_THRESHOLD = 6;

/** Market scanning cadence. */
export const MARKET_SCAN_INTERVAL = 200;

/** Minimum credits to retain before spending on trades. */
export const MARKET_CREDIT_FLOOR = 10000;

/** Maximum units to trade in a single tick to avoid market spam. */
export const MARKET_MAX_SPEND_PER_TICK = 4000;

/** Terminal energy reserve to preserve logistics throughput. */
export const MARKET_TERMINAL_ENERGY_RESERVE = 2000;

/** Price flexibility multiplier during war posture. */
export const MARKET_PRICE_FLEX_WAR = 1.25;

/** Emergency multiplier for critical shortages. */
export const MARKET_EMERGENCY_FACTOR = 1.5;
