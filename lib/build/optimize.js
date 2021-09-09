import babel from "@babel/core"
import { resolve } from "path"
import { promises } from "fs"

const { readdir, writeFile } = promises

const options = {
  plugins: [
    "./lib/build/plugins/transform-remove-invariant.js",
    ["add-import-extension", { extension: "js", replace: true }],
  ],
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
    const transformed = await babel.transformFileAsync(file, options)
    await writeFile(file, transformed.code)
  }
})()
