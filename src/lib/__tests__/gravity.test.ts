import { REACTION_KINDS, REACTION_LABEL } from "../gravity";

describe("Gravity Constants", () => {
  describe("REACTION_KINDS", () => {
    it("should contain all expected reaction types", () => {
      expect(REACTION_KINDS).toEqual([
        "like",
        "useful",
        "laugh",
        "tsukkomi",
        "agree",
        "heavy"
      ]);
    });
  });

  describe("REACTION_LABEL", () => {
    it("should map reaction kinds to their Japanese labels", () => {
      expect(REACTION_LABEL).toEqual({
        like: "いいね",
        useful: "参考になった",
        laugh: "笑った",
        tsukkomi: "ツッコミ",
        agree: "なるほど",
        heavy: "重い"
      });
    });

    it("should have labels for all reaction kinds", () => {
      REACTION_KINDS.forEach(kind => {
        expect(REACTION_LABEL).toHaveProperty(kind);
      });
    });
  });
});