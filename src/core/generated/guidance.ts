/* eslint-disable */
/**
 * Auto-generated from schema/resume.schema.json. Do not edit directly.
 * Run `bun run generate` or `npm run generate` to regenerate.
 */

export const FIELD_BOUNDS = {
  "maxInputBytes": 131072,
  "maxPages": [
    1,
    2
  ],
  "document": {
    "title": {
      "minLength": 1,
      "maxLength": 100
    }
  },
  "profile": {
    "name": {
      "minLength": 1,
      "maxLength": 100
    },
    "headline": {
      "maxLength": 120
    },
    "email": {
      "minLength": 3,
      "maxLength": 254
    },
    "phone": {
      "minLength": 1,
      "maxLength": 40
    },
    "location": {
      "minLength": 1,
      "maxLength": 100
    },
    "maxLinks": 4,
    "link": {
      "label": {
        "minLength": 1,
        "maxLength": 40
      },
      "url": {
        "minLength": 1,
        "maxLength": 2048
      }
    }
  },
  "summary": {
    "minLength": 1,
    "maxLength": 900
  },
  "sectionOrder": {
    "count": 6,
    "sections": [
      "summary",
      "experience",
      "education",
      "projects",
      "skills",
      "certifications"
    ]
  },
  "experience": {
    "maxItems": 12,
    "employer": {
      "minLength": 1,
      "maxLength": 100
    },
    "role": {
      "minLength": 1,
      "maxLength": 100
    },
    "location": {
      "minLength": 1,
      "maxLength": 100
    },
    "maxBullets": 8,
    "bullet": {
      "minLength": 1,
      "maxLength": 360
    }
  },
  "education": {
    "maxItems": 6,
    "institution": {
      "minLength": 1,
      "maxLength": 140
    },
    "qualification": {
      "minLength": 1,
      "maxLength": 140
    },
    "location": {
      "minLength": 1,
      "maxLength": 100
    },
    "maxDetails": 3,
    "detail": {
      "minLength": 1,
      "maxLength": 240
    }
  },
  "projects": {
    "maxItems": 8,
    "name": {
      "minLength": 1,
      "maxLength": 100
    },
    "role": {
      "minLength": 1,
      "maxLength": 100
    },
    "url": {
      "minLength": 1,
      "maxLength": 2048
    },
    "maxBullets": 6,
    "bullet": {
      "minLength": 1,
      "maxLength": 360
    }
  },
  "skills": {
    "maxGroups": 8,
    "category": {
      "minLength": 1,
      "maxLength": 60
    },
    "minItemsPerGroup": 1,
    "maxItemsPerGroup": 15,
    "item": {
      "minLength": 1,
      "maxLength": 280
    }
  },
  "certifications": {
    "maxItems": 12,
    "name": {
      "minLength": 1,
      "maxLength": 140
    },
    "issuer": {
      "minLength": 1,
      "maxLength": 100
    },
    "url": {
      "minLength": 1,
      "maxLength": 2048
    }
  }
} as const;

export const EDITORIAL_GUIDANCE = {
  "document": {
    "title": {
      "recommendedMinChars": 20,
      "recommendedMaxChars": 60
    }
  },
  "profile": {
    "headline": {
      "recommendedMinWords": 5,
      "recommendedMaxWords": 12,
      "recommendedMinChars": 40,
      "recommendedMaxChars": 80
    },
    "recommendedLinks": {
      "min": 1,
      "max": 3
    }
  },
  "summary": {
    "recommendedMinWords": 40,
    "recommendedMaxWords": 75,
    "recommendedMinChars": 250,
    "recommendedMaxChars": 500,
    "advice": "Concise factual summary. Omit rather than including generic buzzwords."
  },
  "experience": {
    "recommendedRoles": {
      "min": 2,
      "max": 4
    },
    "recommendedBulletsPerRole": {
      "min": 3,
      "max": 5
    },
    "bullet": {
      "recommendedMinWords": 15,
      "recommendedMaxWords": 30,
      "recommendedMinChars": 90,
      "recommendedMaxChars": 180,
      "advice": "Start with an action verb, provide context, and cite a supported outcome without inventing facts."
    }
  },
  "education": {
    "recommendedItems": {
      "min": 1,
      "max": 3
    }
  },
  "projects": {
    "recommendedItems": {
      "min": 1,
      "max": 3
    },
    "bullet": {
      "recommendedMinWords": 15,
      "recommendedMaxWords": 30,
      "recommendedMinChars": 90,
      "recommendedMaxChars": 180
    }
  },
  "skills": {
    "recommendedGroups": {
      "min": 3,
      "max": 5
    },
    "recommendedItemsPerGroup": {
      "min": 4,
      "max": 8
    }
  },
  "certifications": {
    "recommendedItems": {
      "min": 0,
      "max": 4
    }
  }
} as const;

export const TEMPLATES = [
  {
    "id": "classic",
    "name": "Classic (LaTeX)",
    "columns": 1,
    "fontFamily": "serif",
    "readingOrder": "single-column-chronological",
    "atsOptimized": true,
    "description": "Canonical single-column LaTeX/SWE resume template matching the standard software engineering format."
  },
  {
    "id": "executive",
    "name": "Executive (Two-Column)",
    "columns": 2,
    "fontFamily": "sans-serif",
    "readingOrder": "two-column-sidebar",
    "atsOptimized": false,
    "readingOrderCaveat": "Two-column layout places secondary sections in a dedicated right sidebar. Best for human review; some legacy ATS parsers prefer single-column linear order.",
    "description": "Modern two-column layout with prominent left-aligned header, company monogram badges, accent styling, and right sidebar for skills and credentials."
  }
] as const;

export const ACCENTS = [
  "slate",
  "navy",
  "forest",
  "ocean"
] as const;
