## Entities

### Entity Index

All entity state, other than component data, is stored in a `Registry`'s **entity index**. The entity index is a single `Uint32Array`, where each entity is represented as six 32-bit indices (24 bytes) laid out like so:

```
   │┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ entity ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄│
   ┌────────────────────────────────────────────────────────┐
   │    id    │   lock   │    gen   │  offset  │ type(lo) │ type(hi) ┃
   └────────────────────────────────────────────────────────┘
     (4 bytes)  (4 bytes)  (4 bytes)  (4 bytes)  (4 bytes)  (4 bytes)
```

The purpose of each index is outlined below:

- `id` - the entity's 32 bit identifier
- `lock` - used by the `Lock` module to temporarily limit access to this entity to a single thread
- `gen` - the current generation (or version) of the entity identifier, incremented each time the entity is destroyed
- `offset` - the entity's offset in its current table (described in the [Tables](#Tables) section below)
- `type(lo)` - the lower 32 bits of the entity's type hash
- `type(hi)` - the upper 20 bits of the entity's type hash

The entity index is shared between all of a world's threads.

Acquiring an entity lock should restrict any changes to the generation, type hash, and offset of that entity to the acquiring thread. In plain terms, the `Registry` module should ensure that when an entity is locked, it can only be modified (i.e. by adding or removing components, or destroying the entity) by the thread that acquired the lock.

Any registry function that would modify the entity should first acquire a lock. These functions include:

- `set` - potentially changes the entity's `type`
- `unset` - always changes the entity's `type`
- `destroy` - sets `type=ENTITY_FREE` and increments `gen`

### Dynamic Length

The initial size of the entity index is configured when creating a registry. The entity index will double in size each time it nears its maximum capacity. The threshold at which this doubling occurs is determined by the registry's `entityLoadFactor`, which can be configured by a user when creating a world.

As of 2021, JavaScript doesn't support growable, shared memory. Because of this, when the entity index grows, its memory must be copied into a new `SharedArrayBuffer`. The thread which initialized the new memory must share the `SharedArrayBuffer` with all other threads using `postMessage`. This process happens quickly since the memory doesn't need to be copied, but it takes an indeterminate amount of time. So, we need a way to synchronously check if the entity index is stale, so we can asynchronously await the fresh one.

The first index of an entity index contains a bit that is flipped when the memory becomes stale.

## Tables

Tables store an entity's component data.

An entity's type hash in the registry's entity index points to the current table which holds its component data.

Tables are shared between threads and can be created at any time during execution. The memory reserved by a table is dynamic in size, similar to the entity index.

A thread that wishes to move component data into a table should also acquire a lock.

### Table Index

Tables should grow over time as they are added to, instead of reserving all potential memory upfront. This makes tables challening to thread properly since JS doesn't have growable shared memory.
When a table needs to grow, we must copy the previous SharedArrayBuffers and grow them by some factor. After the new
SharedArrayBuffers are created, we must re-share them with other threads. This introduces a race condition
that can only be solved with some sort of "soft lock" that prevents a thread from updating a SharedArrayBuffer that
will soon be discarded (because a thread decided the table should grow).

This is solved with table versions. The version increments each time a thread decides the table should grow.

Table versions are stored on the entity index.
