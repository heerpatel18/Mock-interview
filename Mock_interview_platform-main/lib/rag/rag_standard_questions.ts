/**
 * STANDARD QUESTIONS BANK - Production Interview Questions
 * 
 * RAG-style approach: Retrieve from predefined knowledge base instead of generating via LLM
 * Benefits:
 * - Low cost (no LLM calls)
 * - Low latency
 * - Consistent evaluation
 * - Deterministic results
 * 
 * Organized by tech stack → difficulty level → questions array
 * Each difficulty level (easy/medium/hard):
 * - easy → junior level
 * - medium → mid-level
 * - hard → senior level
 */

export const STANDARD_QUESTIONS = {
  react: {
   junior: [
  "What is React and why is it used?",
  "What are components in React?",
  "What is JSX?",
  "What are props in React?",
  "What is state in React?",
  "What is the useState hook?",
  "What is the useEffect hook used for?",
  "What is the Virtual DOM?",
  "What is the difference between props and state?",
  "How do you handle events in React?"
],
    medium: [
  "What race condition occurs when two Redux dispatches fire simultaneously on the same slice and the reducer receives an intermediate state from the first?",
  "What race condition occurs when a component mounts, unmounts, and remounts rapidly during route transitions and pending state updates queue out of order?",
  "What state inconsistency appears when a Context Provider recreates its value object on every parent render and all consumers re-render unnecessarily under load?",
  "What state inconsistency appears when two async state updates collide after a re-render cycle and the second update reads a stale closure value?",
  "What memory leak appears when an arrow function event handler is recreated on every render without useCallback and the child registers a new DOM listener each time?",
  "What happens when useCallback has missing dependencies and the cached function drives a downstream effect that reads outdated values?",
  "What race condition occurs when setTimeout fires a state update after a concurrent render has already committed a newer state and the stale update overwrites it?",
  "What happens when useMemo recomputes due to a dependency that changes identity on every render and causes cascading child re-renders under heavy load?",
  "What state inconsistency appears when a custom hook's closure captures props from the previous render cycle and returns derived values based on outdated data?",
  "What memory issue arises when an unresolved Promise inside useEffect holds a reference to a component's state setter after the component unmounts?",
],
    senior: [
  "What state corruption appears when useTransition wraps a mutating update and concurrent rendering commits the UI in a partially updated state?",
  "What happens when a Suspense boundary pauses and a sibling boundary also suspends simultaneously, causing React to discard both trees and render a stale fallback?",
  "What state ordering problem appears when multiple useReducer dispatches fire during React 18 automatic batching and the reducer receives actions in a non-deterministic order?",
  "What race condition occurs when React Concurrent Features read from an external mutable store mid-render and the store mutates before the commit phase?",
  "What happens when useLayoutEffect runs after a concurrent render interruption and reads a DOM layout that belongs to a previously abandoned render tree?",
  "What memory leak appears when a useCallback captures a Context value, the Context updates, and the old callback holds a circular reference preventing garbage collection?",
  "What state corruption occurs when multiple setState callbacks execute during batching and each callback reads from the previous state that another callback already mutated?",
  "What state inconsistency appears when useDeferredValue defers a value but a synchronous update commits first, causing the UI to display both old and new states simultaneously?",
  "What happens when React Concurrent Rendering pauses inside a third-party animation library's callback and the library mutates DOM nodes that React expects to own?",
  "What race condition appears when useId generates IDs during a concurrent render transition and a second render interrupts before the IDs are committed, producing duplicate IDs in the DOM?",
],
  },
  javascript: {
   junior: [
  "What is JavaScript and where is it used?",
  "What is the difference between var, let, and const?",
  "What is a function in JavaScript?",
  "What is an array and how do you use it?",
  "What is an object in JavaScript?",
  "What is the difference between == and ===?",
  "What is a callback function?",
  "What is a promise?",
  "What does setTimeout do?",
  "What is JSON in JavaScript?"
],
    medium: [
  "What race condition occurs when multiple async/await chains read and write to the same object concurrently and each chain overwrites the other's partial update?",
  "What happens when Promise.all receives one rejecting promise mid-flight and silently discards the resolved results of the other already-completed promises?",
  "What state corruption appears when destructuring assignment fails mid-operation on a deeply nested path and leaves variables in a partially initialized state?",
  "What happens when a generator function pauses inside a try block and the finally clause executes before the caller resumes it, running teardown logic out of order?",
  "What memory leak appears when an event listener holds a reference to its registering object, the object holds the listener, and neither is released after the element is removed?",
  "What happens when a Proxy trap executes during garbage collection and the trap accesses an object that is mid-finalization, causing undefined behavior?",
  "What state inconsistency appears when a WeakMap key is garbage collected unexpectedly mid-operation and a running function loses access to its associated metadata?",
  "What happens when an async generator yields while external state mutates and the resumed generator processes a value that no longer matches the application state?",
  "What happens when a for...of loop throws inside a finally block of an async function and the promise chain receives two concurrent rejection signals?",
  "What race condition appears when a hoisted var declaration is assigned inside a callback that fires before the outer function's synchronous assignment executes?",
],
    senior: [
  "What happens when Symbol.iterator is overridden mid-iteration and the iterator protocol receives an object that no longer conforms to the expected interface?",
  "What state corruption occurs when a Proxy trap intercepts a write on a non-configurable, non-writable property and silently fails in strict mode while succeeding in sloppy mode?",
  "What race condition occurs when two async iterators consume the same shared resource concurrently and one iterator's next() call mutates state the other iterator depends on?",
  "What memory issue arises when a FinalizationRegistry callback fires during an async microtask and attempts to access an object that is already partially reclaimed?",
  "What happens when Reflect.defineProperty interleaves with an active property descriptor change and the object's internal slot enters an inconsistent state mid-operation?",
  "What state inconsistency appears when Object.defineProperty sets an accessor on an inherited prototype and a subclass instance reads a getter that returns a value from the wrong receiver?",
  "What happens when an async function resumes after await during an active JSON.stringify serialization pass and mutates the object being serialized mid-traversal?",
  "What race condition appears when Array.splice executes on an array mid-iteration inside a for...of loop and the iterator's index cursor skips or double-reads elements?",
  "What timing issue occurs when a microtask queued by Promise.then executes before a queueMicrotask callback that was scheduled first, violating expected ordering?",
  "What happens when BigInt arithmetic produces a value exceeding safe integer range during a concurrent operation and a parallel branch performs Number() coercion on the result?",
],
  },
  typescript: {
   junior: [
  "What is TypeScript and why is it used?",
  "What is the difference between TypeScript and JavaScript?",
  "What are types in TypeScript?",
  "What is an interface?",
  "What is a type alias?",
  "What is the difference between interface and type?",
  "What are optional properties?",
  "What is the any type?",
  "What is unknown in TypeScript?",
  "How do you define a function type?"
],
    medium: [
  "What type narrowing failure occurs when a typeof check on a union type collides with an overloaded function signature and TypeScript selects the wrong overload branch?",
  "What happens when generic type inference fails on a recursive type definition and TypeScript falls back to unknown, breaking downstream generic constraints?",
  "What type corruption appears when two modules perform interface augmentation on the same declaration and the merged type creates conflicting method signatures?",
  "What happens when a conditional type creates a circular dependency and TypeScript's type instantiation enters a deferred resolution loop, producing an any escape?",
  "What type safety issue arises when keyof is applied to a partially bounded generic and the resulting key type includes keys that don't exist on all constraint members?",
  "What happens when as const assertion is applied to a nested object and TypeScript widens the inner tuple types during generic inference, losing literal precision?",
  "What type inconsistency appears when a distributive conditional type operates over a union and one union member causes the conditional to distribute into an unintended branch?",
  "What happens when a generic function's type conflicts with its overload signatures and TypeScript resolves the call site to the generic fallback instead of the intended overload?",
  "What type error occurs when infer is used inside a recursive mapped type and TypeScript's instantiation depth limit is hit, returning any for deeply nested paths?",
  "What happens when a template literal type fails to match all string variations in a union and a valid string literal is incorrectly assigned type never?",
],
    senior: [
  "What type inference failure occurs when two generic type parameters are mutually dependent and TypeScript's bidirectional inference produces an ambiguous constraint resolution?",
  "What happens when a recursive Omit utility type creates a self-referential type alias and TypeScript's type instantiation depth limit triggers, collapsing the type to any?",
  "What type corruption appears when TypeScript's maximum type instantiation depth is exceeded on a complex mapped type and silently substitutes any in place of the computed type?",
  "What happens when conditional type distribution conflicts with variance rules and TypeScript allows an unsafe assignment that a stricter variance check would have rejected?",
  "What type safety breach occurs when a branded type is stripped by a type guard that checks only the structural shape and discards the brand discriminant mid-pipeline?",
  "What happens when generic inference fails at the intersection of multiple constraints and TypeScript widens the inferred type to the constraint's upper bound instead of the call-site literal?",
  "What type inconsistency appears when a generic function parameter is covariant in one overload and contravariant in another, and TypeScript selects the wrong variance at the call site?",
  "What happens when a mapped type applies a conditional wrapper and the resulting type creates an anomaly where accessing a key returns a type inconsistent with the original interface?",
  "What type error occurs when a generic class method's overload resolution fails because the type parameter is constrained differently across overloads and TypeScript picks the least specific?",
  "What happens when template literal types are combined with recursive mapped types and TypeScript's structural comparison collapses distinct string brands into the same resolved type?",
],
  },
  nodejs: {
    junior: [
  "What is Node.js?",
  "Is Node.js single-threaded?",
  "What is the event loop?",
  "What is npm?",
  "What are modules in Node.js?",
  "What is require()?",
  "What is package.json?",
  "How do you create a simple server in Node.js?",
  "What is asynchronous programming in Node.js?",
  "What is a callback function?"
],
    medium: [
  "Which race condition occurs when fs.rename is executed while another process or stream is actively reading the same file in Node.js?",
  "What happens when a database connection pool is exhausted under high traffic and incoming requests continue attempting to acquire connections?",
  "What state corruption appears when a Node.js cluster worker crashes mid-transaction and the request is retried without idempotency safeguards?",
  "What occurs when a stream.pipe chain breaks at an intermediate destination and upstream streams continue pushing data without error propagation?",
  "What memory issue arises when circular dependencies exist between modules and require() caches partially initialized exports in Node.js?",
  "What happens when process.nextTick callbacks accumulate faster than the event loop can process them, starving I/O operations?",
  "What state inconsistency appears when setImmediate and setTimeout callbacks interleave unpredictably under varying event loop phases?",
  "What occurs when async/await logic is mixed with legacy callback-based APIs and errors are not consistently propagated through both models?",
  "Which race condition occurs when a cluster worker exits and a restart is triggered while in-flight requests are still being handled?",
  "What happens when a native C++ addon crashes during execution and brings down the Node.js process under load?",
],
   senior: [
  "Which race condition occurs when vm.runInContext executes untrusted code that retains references to objects during garbage collection and leaks memory across contexts?",
  "What happens when libuv's event loop blocks on synchronous DNS resolution during a traffic spike and delays all pending I/O callbacks?",
  "What state corruption appears when multiple Node.js cluster workers share mutable state through external storage and concurrent writes occur without locking?",
  "What memory issue arises when closures captured in setImmediate callbacks retain large objects and prevent garbage collection under sustained load?",
  "What occurs when stream backpressure fails to propagate through multiple middleware layers and upstream producers continue overwhelming the system?",
  "What happens when worker_threads share an ArrayBuffer and one worker crashes while another is mutating the shared memory region?",
  "What state inconsistency appears when AsyncLocalStorage context is lost during asynchronous boundaries such as promises or native bindings?",
  "Which race condition occurs when sticky sessions route requests to restarting cluster workers and session state becomes inconsistent across workers?",
  "What's the runtime impact when Node.js reaches the --max-old-space-size limit during peak load and garbage collection pauses block request processing?",
  "What happens when require.cache is mutated during module initialization and partially loaded modules are reused across concurrent requests?",
],
  },
  express: {
junior: [
  "What is Express.js?",
  "How do you create a basic Express server?",
  "What is middleware in Express?",
  "What are req and res objects?",
  "How do you define a route in Express?",
  "What is the difference between app.get and app.post?",
  "How do you send a response in Express?",
  "What is next() in middleware?",
  "What is JSON parsing middleware?",
  "How do you handle query parameters in Express?"
],
   medium: [
  "Which race condition occurs when concurrent requests mutate shared state inside Express middleware and each request reads stale or partially updated values?",
  "What happens when authentication middleware is bypassed for preflight OPTIONS requests and unauthorized access is unintentionally allowed?",
  "What state corruption appears when compression middleware conflicts with streaming responses and partial compressed data is sent?",
  "What occurs when rate limiting middleware does not account for client retries and legitimate users are incorrectly throttled under load?",
  "What memory issue arises when logging middleware buffers large request bodies and retains them across multiple requests under high traffic?",
  "What happens when try/catch blocks fail to catch errors thrown inside async route handlers and the error propagates unhandled?",
  "What state inconsistency appears when route declaration order changes and error-handling middleware is skipped or incorrectly triggered?",
  "What occurs when a request timeout triggers after response headers are already sent and Express attempts to terminate the connection?",
  "Which race condition occurs when session data is updated concurrently across multiple requests and later writes overwrite earlier updates?",
  "What happens when proxy middleware loses upstream connection mid-response and Express cannot complete the downstream response?",
],
senior: [
  "What happens when middleware continues execution after the response has ended due to missing return statements and additional writes are attempted?",
  "Which race condition occurs when sticky sessions are used during rolling deployments and session affinity breaks across newly spawned instances?",
  "What state corruption appears when nested middleware layers mutate shared request objects and later middleware reads inconsistent values?",
  "What memory issue arises when circular dependencies exist between middleware modules and cached references prevent garbage collection?",
  "What occurs when stream.pipe backpressure fails across multiple Express middleware layers and response buffering overwhelms the server?",
  "What happens when authentication token validation overlaps with session expiration and conflicting authorization states are produced?",
  "What state inconsistency appears when a request passes through multiple processing layers and intermediate transformations override previous state unintentionally?",
  "Which race condition occurs when distributed tracing spans are created across middleware and asynchronous boundaries lose context propagation?",
  "What's the runtime impact when request timeout configuration conflicts with long-lived streaming responses such as SSE or file downloads?",
  "What happens when an error-handling middleware executes after the client disconnects and Express attempts to write to a closed socket?",
],
  },
  mongodb: {
junior: [
  "What is MongoDB?",
  "What is a document in MongoDB?",
  "What is a collection?",
  "What is the difference between SQL and MongoDB?",
  "How do you insert a document in MongoDB?",
  "How do you query data using find()?",
  "What is an index in MongoDB?",
  "What is the difference between findOne and find?",
  "What is ObjectId?",
  "What is a schema in MongoDB?"
],
   medium: [
  "Which race condition occurs when concurrent updates modify the same array field in a document and positional updates overwrite each other?",
  "What happens when an aggregation pipeline exceeds memory limits and disk use is disabled during high-load query execution?",
  "What state corruption appears when a multi-document transaction partially commits due to network interruption and retry logic is not idempotent?",
  "What occurs when connection pool exhaustion happens during a traffic spike and incoming database operations are queued or dropped?",
  "What memory issue arises when cursors are not closed properly and accumulate across multiple long-running queries?",
  "What happens when read preference routes a query to a secondary node during replica set rebalancing and returns stale data?",
  "What state inconsistency appears when a compound index is defined with incorrect field order and queries use a different access pattern?",
  "Which race condition occurs when index creation runs concurrently with write operations and queries observe inconsistent index usage?",
  "What occurs when a $lookup aggregation stage joins against a collection that is dropped or renamed mid-query execution?",
  "What happens when a sharding key field becomes missing or mutated during a chunk migration and routing fails?",
],
senior: [
  "Which race condition occurs when causal consistency guarantees break during a network partition and reads observe out-of-order writes across replicas?",
  "What happens when write concern levels conflict with replica set configuration during reconfiguration and writes are acknowledged inconsistently?",
  "What state corruption appears when a sharding chunk migration is interrupted mid-operation and documents are duplicated or lost across shards?",
  "What memory issue arises when a complex $graphLookup aggregation runs on a large dataset and exhausts server memory under concurrent load?",
  "What occurs when change streams fall behind due to subscriber lag and resume tokens become invalid during oplog rollover?",
  "What happens when BSON parsing fails on a corrupted oplog entry and replication across nodes becomes inconsistent?",
  "What state inconsistency appears when time-series collection bucketing is affected by clock skew across distributed nodes?",
  "Which race condition occurs during distributed transactions across multiple shards and commit coordination fails under network latency?",
  "What's the runtime impact when journaling fsync operations are delayed under peak write load and durability guarantees are temporarily weakened?",
  "What happens when a wildcard index causes the query optimizer to evaluate excessive candidate plans and degrades performance under complex queries?",
],
  },
  sql: {
junior: [
  "What is SQL?",
  "What is a database table?",
  "What is a primary key?",
  "What is a foreign key?",
  "What is the difference between SELECT and INSERT?",
  "What is a WHERE clause?",
  "What is a JOIN?",
  "What is the difference between INNER JOIN and LEFT JOIN?",
  "What is an index?",
  "What is NULL in SQL?"
],
   medium: [
  "Which race condition occurs when concurrent transactions update the same row and last-write wins overwrites intermediate updates?",
  "What happens when a query execution plan changes due to stale statistics and performance degrades under production load?",
  "What state corruption appears when a lower isolation level allows dirty or non-repeatable reads during multi-step transactions?",
  "What occurs when N+1 queries are executed under pagination with OFFSET and database load increases linearly with page depth?",
  "What memory issue arises when prepared statements are not closed and accumulate across multiple connections under load?",
  "What happens when a prepared statement receives a parameter of incorrect type and implicit casting leads to incorrect query results?",
  "What state inconsistency appears when join order leads to a cross join explosion and intermediate result sets become excessively large?",
  "Which race condition occurs when DDL operations like ALTER TABLE run concurrently with DML operations and block or invalidate queries?",
  "What occurs when a query timeout interrupts execution during a multi-table join and partial processing has already consumed resources?",
  "What happens when a connection pool reaches its maximum size during a backlog of transactions and new requests are delayed or dropped?",
],
senior: [
  "Which race condition occurs when phantom reads appear during concurrent inserts under weaker isolation levels and queries observe shifting result sets?",
  "What happens when a distributed transaction commit succeeds on one database but fails on another and consistency across systems is broken?",
  "What state corruption appears when an index rebuild occurs concurrently with active queries and intermediate index states affect read accuracy?",
  "What memory issue arises when correlated subqueries generate inefficient execution plans and consume excessive memory under large datasets?",
  "What occurs when serializable isolation level triggers cascading transaction aborts under high contention workloads?",
  "What happens when the query optimizer misestimates cardinality and selects an inefficient execution plan under skewed data distribution?",
  "What state inconsistency appears when temporal tables record overlapping or missing validity periods under concurrent updates?",
  "Which race condition occurs in multi-version concurrency control when snapshot reads observe stale versions during concurrent writes?",
  "What's the runtime impact when background maintenance tasks like vacuum or index rebuild overlap with peak query load?",
  "What happens when replication lag increases on a standby database and read queries return stale or inconsistent data?",
],
  },
  python: {
junior: [
  "What is Python?",
  "What are lists in Python?",
  "What is a dictionary?",
  "What is the difference between list and tuple?",
  "What is a function in Python?",
  "What is a loop in Python?",
  "What is indentation in Python?",
  "What are variables in Python?",
  "What is a class in Python?",
  "What is the difference between == and is?"
],
medium: [
  "Which race condition occurs when multiple threads execute CPU-bound Python code under the GIL and shared state updates interleave unpredictably?",
  "What happens when async/await code invokes blocking I/O operations and the event loop is stalled under concurrent tasks?",
  "What state corruption appears when pickle deserializes untrusted data and arbitrary code execution modifies application state?",
  "What occurs when a context manager implements __enter__ but fails to correctly handle cleanup logic in __exit__ during exceptions?",
  "What memory issue arises when circular references exist between objects that define __del__ methods and garbage collection cannot reclaim them?",
  "What happens when metaclass descriptors override attribute access and shadow instance attributes unexpectedly during runtime?",
  "What state inconsistency appears when a @property method mutates internal state and repeated access produces different results?",
  "Which race condition occurs when multiprocessing workers modify shared memory without proper synchronization primitives?",
  "What occurs when a generator expression is prematurely closed and dependent downstream logic expects further yielded values?",
  "What happens when __getattr__ is implemented incorrectly and recursive attribute access leads to infinite recursion?",
],
senior: [
  "Which race condition occurs when asyncio.gather executes multiple tasks and one task raises an exception while others continue mutating shared state?",
  "What happens when monkey-patching modifies core objects and garbage collection later interacts with altered references under runtime pressure?",
  "What state corruption appears when weak references are used and referenced objects are garbage collected during active access?",
  "What memory issue arises when exception tracebacks retain frame references and prevent large object graphs from being garbage collected?",
  "What occurs when __slots__ are defined on a class and dynamic attribute assignment is attempted, causing inconsistent attribute access patterns?",
  "What happens when an async context manager is cancelled during execution and cleanup logic in __aexit__ races with task cancellation?",
  "What state inconsistency appears when copy.deepcopy operates on cyclic data structures and shared references are duplicated incorrectly?",
  "Which race condition occurs when asyncio event loop handles OS signals concurrently with running tasks and interrupt handling is delayed or reordered?",
  "What's the runtime impact when sys.setprofile hooks interact with async tasks and introduce overhead or timing inconsistencies?",
  "What happens when type hints interact with metaclasses and runtime class creation results in conflicts between expected and actual type behavior?",
],
  }
} as const;

/**
 * Tech aliases for normalization
 * Maps user input variations to standard keys in STANDARD_QUESTIONS
 */
export const TECH_ALIASES: Record<string, string[]> = {
  react: ["react", "reactjs", "react.js"],
  javascript: ["javascript", "js", "node"],
  typescript: ["typescript", "ts"],
  nodejs: ["node", "nodejs", "node.js", "express.js"],
  express: ["express", "expressjs", "express.js"],
  mongodb: ["mongo", "mongodb"],
  sql: ["sql", "mysql", "postgres", "postgresql", "sqlite", "mariadb"],
  python: ["python", "python3", "py"],
};

/**
 * Get standard key from user input
 * @param tech User provided tech name (can be any case/format)
 * @returns Normalized standard key, or null if not found
 */
export function normalizeTech(tech: string): keyof typeof STANDARD_QUESTIONS | null {
  const normalizedInput = tech.toLowerCase().trim();

  for (const [standardKey, aliases] of Object.entries(TECH_ALIASES)) {
    if (aliases.includes(normalizedInput)) {
      return standardKey as keyof typeof STANDARD_QUESTIONS;
    }
  }

  return null;
}

/**
 * Check if a tech is supported in the question bank
 * @param tech Tech name to check
 * @returns true if supported
 */
export function isTechSupported(tech: string): boolean {
  return normalizeTech(tech) !== null;
}

/**
 * Get all supported techs (for API reference)
 */
export function getSupportedTechs(): string[] {
  return Object.keys(STANDARD_QUESTIONS).sort();
}

/**
 * Normalize interview level to standard keys
 * Maps any level input to the standard question bank keys: junior, medium, senior
 * @param level Any format (e.g., "junior", "mid-level", "Junior Level", "entry")
 * @returns Standardized level key: "junior" | "medium" | "senior"
 */
export function normalizeLevelToQuestionBankKey(
  level: string
): "junior" | "medium" | "senior" {
  const normalized = level.toLowerCase().trim();
  if (normalized.includes("junior") || normalized.includes("entry") || normalized.includes("easy")) 
    return "junior";
  if (
    normalized.includes("mid") ||
    normalized.includes("intermediate") ||
    normalized.includes("medium")
  )
    return "medium";
  if (normalized.includes("senior") || normalized.includes("hard") || normalized.includes("expert")) 
    return "senior";
  return "medium"; // Default
}

