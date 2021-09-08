function isInvariant(name) {
  return /^invariant/.test(name)
}
module.exports = function () {
  return {
    name: "transform-remove-invariant",
    visitor: {
      ImportDeclaration({ node }) {
        node.specifiers = node.specifiers.filter(
          specifier => !isInvariant(specifier.local.name),
        )
      },
      FunctionDeclaration(path) {
        if (isInvariant(path.node.id.name)) {
          path.remove()
          path.stop()
        }
      },
      CallExpression(path) {
        const calleePath = path.get("callee")
        if (isInvariant(calleePath)) {
          path.remove()
        }
      },
    },
  }
}
