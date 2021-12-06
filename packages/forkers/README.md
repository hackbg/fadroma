# Forkers 👷🍴🥩

Because every other Web Worker library I tried was solving the wrong problem.

## Comparison

**Goal**: Get (1) the crawler, (2) the renderer, (3) the layout engine off the main thread.

### First try: `observable-webworker` (589 LoC)

**Expectation:**
* Allows using WebWorkers within an Observable-based system (such as RxJS).
* Message passing between main thread and worker would be transparently encapsulated in
  Observables, which are like Promises but cooler.

**Reality:**
* Found myself defining message types that were one-to-one copy of the exposed API's signature
  (which is already defined once in terms of class methods).
* Ended up with a weirdly baroque init sequence to launch a worker.
* Library project is strangely coupled to Angular.
* RxJS is powerful but has a steep learning curve - trying to express basic features in it
  quickly goes into "premature optimization" territory.
* Observables are like Promises but cooler.

### Second try: `threads.js` (1785 LoC)

**Expectation:**
* Allows using a platform-appropriate implementation of Web Workers/Worker Threads.
* Nice `expose` method, exposing a function or object as the entry point of the worker.
  Should transparently return values.

**Reality:**
* Needed only one implementation of Web Workers so far.
* The `expose` method doesn't work with class instances. Uses `Object.keys()`, and getting the
  list of all methods of a class is... tricky.
* Worker has to be initialized via the library's custom constructor, which is incompatible with how
  Vite processes web workers. As of 2021-12-05, Vite doesn't expose the raw URL of the worker code
  to the dependent module. Adding both Vite and Threads.js as submodules in a workspace resulted in
  the type declarations of their testing frameworks crashing into each other, making the
  contributing of a fix a no-go.
* There was a lot of indirection in the library source code, making it hard to follow the
  control flow by reading the code.

### Third try: `@hackbg/forkers` (80 LoC)

**Expectation:**
* It can't be *this* easy... or can it?
* This library allows you to create a `Promise` or `Observable`, which is then fed data from
  your Web Worker.
* No questions asked (besides whether you want a `Promise` or an `Observable`, both of which
  neatly go over the same wire format.)

**Reality:**
* Requires you to bring your own type checking.
* Correspondence between request and response is maintained via auto-incrementing `BigInt` -
  may be unavailable on older browsers.
* It is best to reason about Web Workers as if they were remote resources.
  Their API mirrors that of WebSockers for a reason.
