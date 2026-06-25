/**
 * tailwind.config.js — Configuration Tailwind partagée
 * Thème République Numérique — Platform-Verification
 */
tailwind.config = {
    darkMode: "class",
    theme: {
        extend: {
            colors: {
                "surface-container-low":     "#f0f3ff",
                "outline-variant":           "#c5c5d5",
                "on-background":             "#111c2c",
                "surface-container":         "#e7eeff",
                "surface-tint":              "#3e54c1",
                "primary-container":         "#002395",
                "on-secondary-container":    "#fffbff",
                "surface-container-lowest":  "#ffffff",
                "on-primary-fixed-variant":  "#223aa8",
                "background":                "#f9f9ff",
                "surface-container-highest": "#d8e3fa",
                "secondary":                 "#bb0021",
                "on-surface-variant":        "#444653",
                "on-secondary":              "#ffffff",
                "primary":                   "#001360",
                "on-primary":                "#ffffff",
                "error":                     "#ba1a1a",
                "on-error":                  "#ffffff",
                "tertiary-container":        "#313437",
                "on-primary-container":      "#8094ff",
                "on-surface":                "#111c2c",
                "secondary-container":       "#e32033",
                "surface-bright":            "#f9f9ff",
                "surface-container-high":    "#dee8ff",
                "surface":                   "#f9f9ff",
                "on-primary-fixed":          "#001159",
                "surface-variant":           "#d8e3fa",
                "on-error-container":        "#93000a",
                "inverse-surface":           "#263142",
                "primary-fixed-dim":         "#bac3ff",
                "inverse-primary":           "#bac3ff",
                "outline":                   "#757684",
                "primary-fixed":             "#dee1ff",
                "secondary-fixed":           "#ffdad7",
                "surface-dim":               "#cfdaf1",
                "tertiary":                  "#1c1f21",
                "on-primary-fixed":          "#001159"
            },
            borderRadius: {
                DEFAULT: "0.25rem",
                lg:      "0.5rem",
                xl:      "0.75rem",
                full:    "9999px"
            },
            spacing: {
                "container-max":   "1200px",
                "margin-desktop":  "48px",
                "margin-mobile":   "16px",
                "gutter":          "24px",
                "unit":            "4px"
            },
            fontFamily: {
                "label-sm":          ["Inter", "sans-serif"],
                "body-md":           ["Inter", "sans-serif"],
                "body-lg":           ["Inter", "sans-serif"],
                "headline-lg-mobile":["Inter", "sans-serif"],
                "headline-md":       ["Inter", "sans-serif"],
                "headline-lg":       ["Inter", "sans-serif"],
                "display":           ["Inter", "sans-serif"],
                "label-md":          ["Inter", "sans-serif"]
            },
            fontSize: {
                "label-sm":          ["12px", { lineHeight:"16px", letterSpacing:"0.05em", fontWeight:"600" }],
                "body-md":           ["16px", { lineHeight:"24px", fontWeight:"400" }],
                "body-lg":           ["18px", { lineHeight:"28px", fontWeight:"400" }],
                "headline-lg-mobile":["24px", { lineHeight:"32px", fontWeight:"600" }],
                "headline-md":       ["24px", { lineHeight:"32px", fontWeight:"600" }],
                "display":           ["48px", { lineHeight:"56px", letterSpacing:"-0.02em", fontWeight:"700" }],
                "label-md":          ["14px", { lineHeight:"20px", letterSpacing:"0.01em", fontWeight:"500" }],
                "headline-lg":       ["32px", { lineHeight:"40px", letterSpacing:"-0.01em", fontWeight:"600" }]
            }
        }
    }
};
