import { describe, expect, it } from "vitest";
import { Kuery } from "./Kuery";

const collection = [
  {
    id: 1,
    name: "Andreas",
    address: { street: "Bellmansgatan" },
    born: new Date("1980-01-01T12:00:00.000Z"),
    isActive: true,
  },
  {
    id: 2,
    name: "Sven",
    address: {},
    girlfriends: [{ wife: {} }],
    born: new Date("1989-01-01T12:00:00.000Z"),
    isActive: true,
  },
  {
    id: 3,
    name: "Christian",
    born: new Date("1990-01-01T12:00:00.000Z"),
    girlfriends: { wife: {} },
    isActive: false,
    parts: [
      {
        name: "part1",
        parts: [],
      },
      {
        name: "part2",
        parts: [
          {
            name: "part2.sub1",
          },
        ],
      },
      {
        name: "part3",
        parts: "",
      },
    ],
  },
  {
    id: 4,
    name: "Emil",
    girlfriends: [
      { name: "fanny", hotness: 10 },
      {
        name: "eve",
        hotness: 1000,
        boyfriends: [
          { id: 4, name: "Emil", girlfriends: [{ name: "fanny", hotness: 10 }, { name: "eve" }] },
          { id: 2, name: "Sven" },
        ],
      },
    ],
    parts: [
      {
        name: "part1",
        parts: [],
      },
      {
        name: "part2",
        parts: [
          {
            name: "part2.sub1",
          },
          {
            name: "part2.sub2",
          },
        ],
      },
      {
        name: "part3",
      },
    ],
    bikes: [
      {
        bike: {
          brand: "trek",
          wheels: [
            { position: "front", type: "carbon" },
            { position: "back", type: "aluminum" },
          ],
        },
      },
      {
        bike: {
          brand: "unicycle",
          wheels: [{ position: "front", type: "aluminum" }],
        },
      },
    ],
    currentBike: [{ brand: "trek", wheels: ["front", "back"] }],
    born: new Date("1982-01-01T12:00:00.000Z"),
  },
  {
    id: 5,
    name: "PG",
    girlfriends: [{ name: "Hanna", hotness: 200 }],
    born: new Date("1989-01-01T12:00:00.000Z"),
    parts: [
      {
        name: "part1",
        parts: [],
      },
      {
        name: "part2",
        parts: [
          {
            name: "part2.sub1",
          },
        ],
      },
      {
        name: "part3",
        parts: "TODO",
      },
      {
        name: "part3",
        parts: {},
      },
    ],
  },
];

const collectionWithNull = [{ id: 6, name: "KE", girlfriends: null }];

describe("Kuery", () => {
  it("should return 0 for empty collection", () => {
    const q = new Kuery({});
    expect(q.find([])).toHaveLength(0);
  });

  it("should return all elements for empty query", () => {
    const q = new Kuery({});
    expect(q.find(collection)).toHaveLength(5);
  });

  it("should return correct element for property eq query", () => {
    const q = new Kuery({ id: 2 });
    expect(q.findOne(collection).name).toBe("Sven");
  });

  it("should return correct element for property $eq query", () => {
    const q = new Kuery({ name: { $eq: "Emil" } });
    expect(q.findOne(collection).name).toEqual("Emil");
  });

  it("should return correct element for property not eq query", () => {
    const q = new Kuery({ id: { $ne: 2 } });
    expect(q.find(collection)).toHaveLength(4);
  });

  it("should return correct elements for property in query", () => {
    const q = new Kuery({ id: { $in: [1, 2] } });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("should return correct elements for property in $nin query", () => {
    const q = new Kuery({ id: { $nin: [1, 2] } });
    expect(q.find(collection)).toHaveLength(3);
  });

  it("should return all elements for property with empty $nin query", () => {
    const q = new Kuery({ id: { $nin: [] } });
    expect(q.find(collection)).toHaveLength(5);
  });

  it("should return correct elements for property with path eq query", () => {
    const q = new Kuery({ "address.street": "Bellmansgatan" });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for property with path ne query", () => {
    const q = new Kuery({ "address.street": { $ne: "Bellmansgatan" } });
    expect(q.find(collection)).toHaveLength(4);
  });

  it("should return correct elements for property with path in query", () => {
    const q = new Kuery({ name: { $in: ["Andreas", "Emil"] } });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("should return correct elements for property in with strings query", () => {
    const q = new Kuery({ name: { $in: ["Andreas", "Emil"] } });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("should return correct elements for property in with strings query", () => {
    const q = new Kuery({ name: { $nin: ["Andreas", "Emil"] } });
    expect(q.find(collection)).toHaveLength(3);
  });

  it("should return correct elements for composite query", () => {
    const q = new Kuery({ name: { $in: ["Andreas", "Emil"] }, id: 1 });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for composite query", () => {
    const q = new Kuery({ name: { $nin: ["Andreas", "Emil"] }, id: 2 });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for composite query", () => {
    const q = new Kuery({ name: { $nin: ["Andreas", "Emil"] }, id: 1 });
    expect(q.find(collection)).toHaveLength(0);
  });

  it("should match when object is null and nested property is checked with $nin", () => {
    const q = new Kuery({
      name: "KE",
      "girlfriends.wife": { $nin: ["Shin Hye-sun"] },
    });

    expect(q.find(collectionWithNull)).toHaveLength(1);
  });

  it("should match when object is null and nested property is checked with $ne", () => {
    const q = new Kuery({
      name: "KE",
      "girlfriends.wife": { $ne: "Shin Hye-sun" },
    });

    expect(q.find(collectionWithNull)).toHaveLength(1);
  });

  it("should not match when object is null and nested property is checked with $in", () => {
    const q = new Kuery({
      name: "KE",
      "girlfriends.wife": { $in: ["Shin Hye-sun"] },
    });

    expect(q.find(collectionWithNull)).toHaveLength(0);
  });

  it("should not match when object is null and nested property is checked with $eq", () => {
    const q = new Kuery({
      name: "KE",
      "girlfriends.wife": { $eq: "Shin Hye-sun" },
    });

    expect(q.find(collectionWithNull)).toHaveLength(0);
  });

  it("should return correct elements for regex string query", () => {
    const q = new Kuery({ name: { $regex: "Andr.*", $options: "i" } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for regex native query", () => {
    const q = new Kuery({ name: { $regex: /andr.*/, $options: "i" } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for inline regex query", () => {
    const q = new Kuery({ name: /andr.*/i });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for negating $elemMatch query", () => {
    const q = new Kuery({ girlfriends: { $not: { $elemMatch: { hotness: 200 } } } });
    expect(q.find(collection)).toHaveLength(4);
  });

  it("should return correct elements for negating $elemMatch regex query", () => {
    const q = new Kuery({ girlfriends: { $not: { $elemMatch: { name: /nny$/i } } } });
    expect(q.find(collection)).toHaveLength(4);
  });

  it("should return correct elements for $or query", () => {
    const q = new Kuery({
      $or: [{ name: /andr.*/i }, { name: /emil.*/i }],
    });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("should return correct elements for $or query when both sides return same element", () => {
    const q = new Kuery({
      $or: [{ name: /andr.*/i }, { name: /andr.*/i }],
    });

    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for property with path eq query with arrays", () => {
    const q = new Kuery({ "girlfriends.name": "eve" });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element for property gte query", () => {
    const q = new Kuery({ id: { $gte: 2 } });
    expect(q.find(collection)).toHaveLength(4);
  });

  it("should return correct element for property lte query", () => {
    const q = new Kuery({ id: { $lte: 2 } });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("should return correct element for property gt query", () => {
    const q = new Kuery({ id: { $gt: 2 } });
    expect(q.find(collection)).toHaveLength(3);
  });

  it("should return correct element for property lt query", () => {
    const q = new Kuery({ id: { $lt: 2 } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element for property lte date query", () => {
    const q = new Kuery({ born: { $lte: new Date("1981-01-01") } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element for property gte date query", () => {
    const q = new Kuery({ born: { $gte: new Date("1981-01-01") } });
    expect(q.find(collection)).toHaveLength(4);
  });

  it("should return correct element for property gte/lte date query", () => {
    const q = new Kuery({ born: { $gte: new Date("1981-01-01"), $lte: new Date("1990-01-01") } });
    expect(q.find(collection)).toHaveLength(3);
  });

  it("should return no elemenst for single elemMatch query with no match", () => {
    const q = new Kuery({ girlfriends: { $elemMatch: { hotness: 222 } } });
    expect(q.find(collection)).toHaveLength(0);
  });

  it("should return correct element for single elemMatch query", () => {
    const q = new Kuery({ girlfriends: { $elemMatch: { hotness: 10 } } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should not return element when using $elemMatch on an object property", () => {
    const q = new Kuery({
      "bikes.bike": { $elemMatch: { brand: "trek" } },
    });

    expect(q.find(collection)).toHaveLength(0);
  });

  it("should return correct element when using $elemMatch on a nested array property", () => {
    const q = new Kuery({
      "bikes.bike.wheels": { $elemMatch: { position: "front" } },
    });

    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element when using elemMatch on nested optional array property", () => {
    const q = new Kuery({
      id: 4,
      "parts.parts": {
        $elemMatch: {
          name: { $eq: "part2.sub1" },
        },
      },
    });

    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element when using $elemMatch on nested array with differing property types", () => {
    const q = new Kuery({
      id: 5,
      "parts.parts": {
        $elemMatch: {
          name: { $eq: "part2.sub1" },
        },
      },
    });

    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element when using $elemMatch on nested array where one type is empty string", () => {
    const q = new Kuery({
      id: 3,
      "parts.parts": {
        $elemMatch: {
          name: { $eq: "part2.sub1" },
        },
      },
    });

    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element when using $elemMatch with multiple conditions on a nested array property", () => {
    const q = new Kuery({
      "bikes.bike.wheels": {
        $elemMatch: {
          position: "front",
          type: "carbon",
        },
      },
    });

    expect(q.find(collection)).toHaveLength(1);
  });

  it("should not return any element when elemMatch does not match on the same item in the array", () => {
    const q = new Kuery({
      "bikes.bike.wheels": {
        $elemMatch: {
          position: "back",
          type: "carbon",
        },
      },
    });
    expect(q.find(collection)).toHaveLength(0);
  });

  it("should not return any element when $elemMatch is not matching on nested array property", () => {
    const q = new Kuery({
      "bikes.bike.wheels": { $elemMatch: { position: "middle" } },
    });

    expect(q.find(collection)).toHaveLength(0);
  });

  it("should return correct element for multipart elemMatch query", () => {
    const q = new Kuery({ girlfriends: { $elemMatch: { hotness: 10, name: "fanny" } } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct element for multipart elemMatch query asserting with $eq and $ne", () => {
    const q = new Kuery({ girlfriends: { $elemMatch: { hotness: { $eq: 10 }, name: { $ne: "eve" } } } });
    const col = q.find(collection);

    expect(col).toHaveLength(1);
    expect(col[0].name).toBe("Emil");
  });

  it("should return no element for multipart elemMatch query matching different array elements", () => {
    const q = new Kuery({ girlfriends: { $elemMatch: { hotness: 10, name: "eve" } } });
    expect(q.find(collection)).toHaveLength(0);
  });

  it("should return correct elements for double nested array elemMatch query", () => {
    const q = new Kuery({ "girlfriends.boyfriends": { $elemMatch: { id: 2, name: "Sven" } } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for triple nested array elemMatch query", () => {
    const q = new Kuery({ "girlfriends.boyfriends.girlfriends": { $elemMatch: { hotness: 10, name: "fanny" } } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return correct elements for negated triple nested array elemMatch query", () => {
    const q = new Kuery({ "girlfriends.boyfriends.girlfriends": { $not: { $elemMatch: { hotness: 10, name: "fanny" } } } });
    expect(q.find(collection)).toHaveLength(4);
  });

  it("should return correct elements for property with path $regexp with arrays", () => {
    const q = new Kuery({ "girlfriends.name": { $regex: "ev.*", $options: "i" } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return elements where given element exists is true", () => {
    const q = new Kuery({ address: { $exists: true } });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("should return elements where given element exists is false", () => {
    const q = new Kuery({ girlfriends: { $exists: false } });
    expect(q.find(collection)).toHaveLength(1);
  });

  it("should return elements where given element exists deeply", () => {
    const q = new Kuery({ "girlfriends.wife": { $exists: true } });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("should return elements where given element does not exists deeply", () => {
    const q = new Kuery({ "address.zipcode": { $exists: false } });
    expect(q.find(collection)).toHaveLength(5);
  });

  it("should return elements when query for boolean", () => {
    const q = new Kuery({ isActive: true });
    expect(q.find(collection)).toHaveLength(2);
  });

  it("$or should do implicit and on subqueries", () => {
    const q = new Kuery({
      $or: [
        {
          "girlfriends.name": "Hanna",
          "girlfriends.hotness": 10,
        },
        { "girlfriends.hotness": 1000 },
      ],
    });

    expect(q.find(collection)).toHaveLength(1);
  });
});
