globalThis.StrideData = {
  "mines": {
    "copper-stair": {
      "name": "Copper Stair",
      "district": "Copper district",
      "art": "ui-concept/copper-stair.webp"
    },
    "pale-quarry": {
      "name": "Pale Quarry",
      "district": "Chalk terraces",
      "art": "world-concepts/mines/pale-quarry.webp"
    },
    "redbank-cut": {
      "name": "Redbank Cut",
      "district": "Iron country",
      "art": "world-concepts/mines/redbank-cut.webp"
    },
    "violet-galleries": {
      "name": "Violet Galleries",
      "district": "Pegmatite galleries",
      "art": "world-concepts/mines/violet-galleries.webp"
    }
  },
  "routes": {
    "green-seam": {
      "mine": "copper-stair",
      "name": "Green Seam",
      "power": 1,
      "seconds": 5,
      "delicate": true,
      "finds": [
        "malachite",
        "malachite",
        "chrysocolla"
      ]
    },
    "blue-pocket": {
      "mine": "copper-stair",
      "name": "Azurite Pocket",
      "power": 1,
      "seconds": 6,
      "delicate": true,
      "finds": [
        "azurite",
        "azurite",
        "azurite",
        "malachite"
      ]
    },
    "reinforced": {
      "mine": "copper-stair",
      "name": "Reinforced Vein",
      "power": 2,
      "seconds": 8,
      "finds": [
        "covellite",
        "chalcanthite",
        "cuprite"
      ]
    },
    "white-face": {
      "mine": "pale-quarry",
      "name": "White Face",
      "power": 1,
      "seconds": 5,
      "finds": [
        "calcite",
        "calcite",
        "calcite",
        "dolomite"
      ]
    },
    "iron-terrace": {
      "mine": "redbank-cut",
      "name": "Iron Terrace",
      "power": 1,
      "seconds": 5,
      "finds": [
        "hematite",
        "hematite",
        "lepidocrocite"
      ]
    },
    "magnetite-bench": {
      "mine": "redbank-cut",
      "name": "Magnetite Bench",
      "power": 1,
      "seconds": 6,
      "finds": [
        "magnetite",
        "magnetite",
        "magnetite",
        "pyrolusite"
      ]
    },
    "iron-fault": {
      "mine": "redbank-cut",
      "name": "Iron Fault",
      "power": 3,
      "seconds": 9,
      "finds": [
        "manganite",
        "manganite",
        "ferrihydrite"
      ]
    },
    "lilac-vein": {
      "mine": "violet-galleries",
      "name": "Lilac Vein",
      "power": 3,
      "seconds": 8,
      "finds": [
        "spodumene",
        "spodumene",
        "kunzite"
      ]
    },
    "zoned-pocket": {
      "mine": "violet-galleries",
      "name": "Zoned Pocket",
      "power": 3,
      "seconds": 10,
      "finds": [
        "elbaite",
        "elbaite",
        "elbaite",
        "fluor-liddicoatite"
      ]
    }
  },
  "tools": {
    "starter": {
      "name": "Miner’s Pickaxe",
      "power": 1,
      "cost": 0,
      "art": "world-concepts/tools/miner-pickaxe.webp",
      "detail": "Works exposed seams in Copper Stair, Pale Quarry and Redbank Cut."
    },
    "copper": {
      "name": "Copper-Bound Pick",
      "power": 2,
      "cost": 30,
      "art": "world-concepts/pickaxes/copper-bound-pick.webp",
      "detail": "Opens the Reinforced Vein in Copper Stair."
    },
    "fine-tip": {
      "name": "Fine-Tip Pick",
      "power": 1,
      "precision": 850,
      "cost": 24,
      "requires": "copper",
      "art": "world-concepts/pickaxes/fine-tip-pick.webp",
      "detail": "Improves potential purity in delicate Copper Stair seams."
    },
    "iron": {
      "name": "Forged-Iron Pick",
      "power": 3,
      "cost": 54,
      "requires": "copper",
      "art": "world-concepts/pickaxes/forged-iron-pick.webp",
      "detail": "Opens Violet Galleries and Iron Fault."
    }
  },
  "mural": {
    "needs": {
      "chalk-white": [
        [
          29,
          11
        ]
      ],
      "malachite-green": [
        [
          11,
          13
        ],
        [
          49,
          14
        ]
      ],
      "azurite-blue": [
        [
          19,
          20
        ]
      ],
      "iron-red": [
        [
          40,
          45
        ]
      ],
      "mintwash": [
        [
          48,
          43
        ]
      ],
      "slate-shadow": [
        [
          14,
          42
        ],
        [
          39,
          24
        ]
      ]
    }
  },
  "missions": {
    "first": {
      "name": "First discovery",
      "text": "Collect your first personal mining find.",
      "metric": "mined",
      "goal": 1,
      "coins": 10
    },
    "routes": {
      "name": "Regular rounds",
      "text": "Collect three personal mining finds.",
      "metric": "mined",
      "goal": 3,
      "coins": 14
    },
    "polish": {
      "name": "Display piece",
      "text": "Polish a specimen for your collection.",
      "metric": "polished",
      "goal": 1,
      "coins": 12
    },
    "sell": {
      "name": "First sale",
      "text": "Sell a specimen to fund equipment.",
      "metric": "sold",
      "goal": 1,
      "coins": 8
    },
    "mix": {
      "name": "Color maker",
      "text": "Mix a crafted color from base pigments.",
      "metric": "mixed",
      "goal": 1,
      "coins": 16
    },
    "paint": {
      "name": "Guild hand",
      "text": "Paint three patches on Copperwing.",
      "metric": "painted",
      "goal": 3,
      "coins": 18
    },
    "complete": {
      "name": "Copperwing restored",
      "text": "Finish the eight remaining patches.",
      "metric": "painted",
      "goal": 8,
      "coins": 30
    }
  },
  "contracts": {
    "quarry-supply": {
      "name": "Quarry Supply",
      "mineral": "calcite",
      "finish": "raw",
      "minWeight": 200,
      "consume": true,
      "coins": 20
    },
    "cabinet-study": {
      "name": "Cabinet Study",
      "mineral": "malachite",
      "finish": "polished",
      "minPurity": 7600,
      "consume": false,
      "coins": 18
    },
    "banner-order": {
      "name": "Guild Banner Order",
      "pigment": "mintwash",
      "quantity": 1,
      "coins": 16
    },
    "violet-commission": {
      "name": "Violet Commission",
      "pigment": "wisteria-mist",
      "quantity": 1,
      "coins": 30
    }
  },
  "expedition": {
    "mine": "silver-fault",
    "name": "Silver Fault Survey",
    "art": "world-concepts/mines/silver-fault.webp",
    "minFinds": 1,
    "lobbySeconds": 3,
    "crew": [
      {
        "name": "Mara",
        "role": "Scout",
        "leadSeconds": 1
      },
      {
        "name": "Ivo",
        "role": "Hauler",
        "leadSeconds": 0
      }
    ],
    "stages": [
      {
        "name": "Survey the split",
        "action": "Mark the vein",
        "text": "Mark a silver seam while the crew maps the split and sets the guide line.",
        "seconds": 5
      },
      {
        "name": "Secure the shaft",
        "action": "Brace the face",
        "text": "Brace the working face while the crew anchors the rope and winch.",
        "seconds": 6
      },
      {
        "name": "Recover the sample",
        "action": "Raise the basket",
        "text": "Recover the silver sample as the crew steadies the line and clears the landing.",
        "seconds": 5
      }
    ],
    "reward": {
      "coins": 18,
      "mineral": "silver",
      "purity": 9125,
      "weight": 84
    }
  },
  "minerals": {
    "malachite": {
      "name": "Malachite",
      "rarity": "Uncommon",
      "base": 3,
      "pigment": "malachite-green",
      "weight": [
        55,
        300
      ]
    },
    "chrysocolla": {
      "name": "Chrysocolla",
      "rarity": "Uncommon",
      "base": 2,
      "pigment": "copper-teal"
    },
    "azurite": {
      "name": "Azurite",
      "rarity": "Uncommon",
      "base": 3,
      "pigment": "azurite-blue",
      "weight": [
        35,
        235
      ]
    },
    "covellite": {
      "name": "Covellite",
      "rarity": "Rare",
      "base": 3,
      "pigment": "ink-indigo",
      "weight": [
        25,
        116
      ]
    },
    "chalcanthite": {
      "name": "Chalcanthite",
      "rarity": "Rare",
      "base": 3,
      "pigment": "azurite-blue",
      "weight": [
        42,
        180
      ]
    },
    "cuprite": {
      "name": "Cuprite",
      "rarity": "Uncommon",
      "base": 3,
      "pigment": "copper-crimson"
    },
    "calcite": {
      "name": "Calcite",
      "rarity": "Common",
      "base": 1,
      "pigment": "chalk-white",
      "weight": [
        100,
        320
      ]
    },
    "dolomite": {
      "name": "Dolomite",
      "rarity": "Common",
      "base": 1,
      "pigment": "limestone-cream",
      "weight": [
        140,
        300
      ]
    },
    "hematite": {
      "name": "Hematite",
      "rarity": "Common",
      "base": 2,
      "pigment": "iron-red",
      "weight": [
        120,
        280
      ]
    },
    "lepidocrocite": {
      "name": "Lepidocrocite",
      "rarity": "Uncommon",
      "base": 2,
      "pigment": "burnt-orange"
    },
    "magnetite": {
      "name": "Magnetite",
      "rarity": "Common",
      "base": 2,
      "pigment": "iron-black",
      "weight": [
        165,
        330
      ]
    },
    "pyrolusite": {
      "name": "Pyrolusite",
      "rarity": "Uncommon",
      "base": 2,
      "pigment": "manganese-black"
    },
    "manganite": {
      "name": "Manganite",
      "rarity": "Uncommon",
      "base": 2,
      "pigment": "umber",
      "weight": [
        125,
        350
      ]
    },
    "ferrihydrite": {
      "name": "Ferrihydrite",
      "rarity": "Uncommon",
      "base": 1,
      "pigment": "rust-brown"
    },
    "spodumene": {
      "name": "Spodumene",
      "rarity": "Uncommon",
      "base": 3,
      "pigment": "lilac",
      "weight": [
        175,
        285
      ]
    },
    "kunzite": {
      "name": "Kunzite",
      "rarity": "Rare",
      "base": 4,
      "pigment": "lilac",
      "weight": [
        100,
        255
      ]
    },
    "elbaite": {
      "name": "Elbaite",
      "rarity": "Rare",
      "base": 4,
      "pigment": "rose-pink",
      "weight": [
        45,
        155
      ]
    },
    "fluor-liddicoatite": {
      "name": "Fluor-liddicoatite",
      "rarity": "Exceptional",
      "base": 5,
      "pigment": "plum",
      "weight": [
        32,
        145
      ]
    },
    "silver": {
      "name": "Silver",
      "rarity": "Rare",
      "base": 4,
      "pigment": "silver-gray"
    }
  },
  "pigments": {
    "malachite-green": {
      "name": "Malachite Green",
      "color": "#2A8B59"
    },
    "copper-teal": {
      "name": "Copper Teal",
      "color": "#319C93"
    },
    "azurite-blue": {
      "name": "Azurite Blue",
      "color": "#3058A5"
    },
    "ink-indigo": {
      "name": "Ink Indigo",
      "color": "#25365C"
    },
    "copper-crimson": {
      "name": "Copper Crimson",
      "color": "#9D263E"
    },
    "chalk-white": {
      "name": "Chalk White",
      "color": "#F5F3E8"
    },
    "limestone-cream": {
      "name": "Limestone Cream",
      "color": "#E7DCBC"
    },
    "iron-red": {
      "name": "Iron Red",
      "color": "#A6362E"
    },
    "burnt-orange": {
      "name": "Burnt Orange",
      "color": "#CB611F"
    },
    "iron-black": {
      "name": "Iron Black",
      "color": "#252830"
    },
    "manganese-black": {
      "name": "Manganese Black",
      "color": "#35313A"
    },
    "umber": {
      "name": "Umber",
      "color": "#5C4037"
    },
    "rust-brown": {
      "name": "Rust Brown",
      "color": "#934D38"
    },
    "lilac": {
      "name": "Lilac",
      "color": "#B5A0CE"
    },
    "rose-pink": {
      "name": "Rose Pink",
      "color": "#D47B9E"
    },
    "plum": {
      "name": "Plum",
      "color": "#533957"
    },
    "silver-gray": {
      "name": "Silver Gray",
      "color": "#BFC9D2"
    },
    "mintwash": {
      "name": "Mintwash",
      "color": "#A7D0B4"
    },
    "slate-shadow": {
      "name": "Slate Shadow",
      "color": "#414659"
    },
    "terracotta": {
      "name": "Terracotta",
      "color": "#BD6E51"
    },
    "blue-charcoal": {
      "name": "Blue Charcoal",
      "color": "#1C293E"
    },
    "wisteria-mist": {
      "name": "Wisteria Mist",
      "color": "#D9C9EB"
    }
  },
  "recipes": {
    "mintwash": {
      "name": "Mintwash",
      "ingredients": {
        "chalk-white": 2,
        "malachite-green": 1
      }
    },
    "slate-shadow": {
      "name": "Slate Shadow",
      "ingredients": {
        "iron-black": 2,
        "azurite-blue": 1
      }
    },
    "terracotta": {
      "name": "Terracotta",
      "ingredients": {
        "iron-red": 2,
        "limestone-cream": 1
      }
    },
    "blue-charcoal": {
      "name": "Blue Charcoal",
      "ingredients": {
        "iron-black": 2,
        "ink-indigo": 1
      }
    },
    "wisteria-mist": {
      "name": "Wisteria Mist",
      "ingredients": {
        "lilac": 2,
        "chalk-white": 1
      }
    }
  }
};
