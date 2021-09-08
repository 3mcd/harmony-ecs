const babel = require("@babel/core")
const { resolve } = require("path")
const {
  promises: { readdir, readFile, writeFile },
} = require("fs")

const options = {
  plugins: ["./lib/build/plugins/transform-remove-invariant.js"],
}

async function* getFiles(dir) {
  const dirents = await readdir(dir, { withFileTypes: true })
  for (const dirent of dirents) {
    const res = resolve(dir, dirent.name)
    if (dirent.isDirectory()) {
      yield* getFiles(res)
    } else {
      yield res
    }
  }
}

;(async () => {
  for await (const file of getFiles(`./lib/dist`)) {
    if (!/\.js$/.test(file)) continue
    const contents = await readFile(file, { encoding: "utf8" })
    const transformed = await babel.transformAsync(contents, options)
    await writeFile(file, transformed.code)
  }
})()
