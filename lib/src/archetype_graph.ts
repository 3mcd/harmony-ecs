import { Archetype, makeArchetype, makeTypeHash, Type, typeContains } from "./archetype"
import { Registry } from "./registry"
import { AnySchema } from "./schema"

export type ArchetypeGraphNode = {
  archetype: Archetype
  leftEdges: Map<AnySchema, ArchetypeGraphNode>
  rightEdges: Map<AnySchema, ArchetypeGraphNode>
}

export function makeArchetypeGraphNode(archetype: Archetype): ArchetypeGraphNode {
  return { archetype, leftEdges: new Map(), rightEdges: new Map() }
}

function makeEdges(
  left: ArchetypeGraphNode,
  right: ArchetypeGraphNode,
  schema: AnySchema,
) {
  left.rightEdges.set(schema, right)
  right.leftEdges.set(schema, left)
}

function linkNode(root: ArchetypeGraphNode, node: ArchetypeGraphNode) {
  if (root.archetype.type.length > node.archetype.type.length - 1) {
    return
  }

  if (root.archetype.type.length < node.archetype.type.length - 1) {
    root.rightEdges.forEach(edge => linkNode(edge, node))
    return
  }

  if (
    root.archetype.type.length === 0 ||
    typeContains(node.archetype.type, root.archetype.type)
  ) {
    let i = 0
    let length = node.archetype.type.length
    for (; i < length && root.archetype.type[i] === node.archetype.type[i]; i++);
    makeEdges(root, node, node.archetype.type[i])
  }
}

function insertArchetype(type: Type, registry: Registry): ArchetypeGraphNode {
  const archetype = makeArchetype(type, registry.size)
  const node = makeArchetypeGraphNode(archetype)
  linkNode(registry.root, node)
  registry.onArchetypeCreated.dispatch(archetype)
  registry.archetypes.set(makeTypeHash(archetype.type), node)
  return node
}

export function findOrMakeArchetype(registry: Registry, type: Type) {
  let node = registry.root
  for (let i = 0; i < type.length; i++) {
    const schema = type[i]
    node = node.rightEdges.get(schema) ?? insertArchetype(type.slice(0, i + 1), registry)
  }
  return node.archetype
}
