import * as Something from "./something"

describe("Something", () => {
  // describe("make", () => {
  //   it("makes!!!!!", () => {
  //     let s = Something.make()
  //     console.log(s)
  //   })
  // })
  describe("add", () => {
    it("increments version counter each time the set grows", () => {
      let s = Something.make(0, 0, 0.5)
      Something.add(s, 1)
      console.log(s)
    })
  })
})
