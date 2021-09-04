import { Archetype, Signature, makeArchetype, signatureIsSupersetOf } from "./archetype"
import { Registry } from "./registry"
import { getSchemaId, AnySchema } from "./schema"

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
  if (root.archetype.signature.length > node.archetype.signature.length - 1) {
    return
  }

  if (root.archetype.signature.length < node.archetype.signature.length - 1) {
    root.rightEdges.forEach(node => linkNode(node, node))
  }

  if (
    root.archetype.signature.length === 0 ||
    signatureIsSupersetOf(root.archetype.signature, node.archetype.signature)
  ) {
    let i = 0
    let length = node.archetype.signature.length
    for (
      ;
      i < length && root.archetype.signature[i] === node.archetype.signature[i];
      i++
    );
    makeEdges(root, node, node.archetype.signature[i])
  }
}

function insertArchetype(signature: Signature, registry: Registry): ArchetypeGraphNode {
  const archetype = makeArchetype(signature, registry.size)
  const node = makeArchetypeGraphNode(archetype)
  linkNode(registry.root, node)
  registry.onArchetypeCreated.dispatch(archetype)
  return node
}

export function findOrMakeArchetype(
  root: ArchetypeGraphNode,
  signature: Signature,
  registry: Registry,
) {
  let node = root
  for (let i = 0; i < signature.length; i++) {
    const schema = signature[i]
    node =
      node.rightEdges[getSchemaId(schema)] ??
      insertArchetype(signature.slice(0, i + 1), registry)
  }
  return node
}
