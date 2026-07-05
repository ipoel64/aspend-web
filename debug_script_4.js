tailwind.config = {
      darkMode: "class",
      theme: {
        extend: {
          "colors": {
            "primary": "#00BCD4",
            "on-primary": "#ffffff",
            "primary-container": "#E0F7FA",
            "on-primary-container": "#006064",
            "primary-fixed": "#B2EBF2",
            "on-primary-fixed": "#00838F",
            
            "secondary": "#AB47BC",
            "on-secondary": "#ffffff",
            "secondary-container": "#F3E5F5",
            "on-secondary-container": "#4A148C",
            "secondary-fixed": "#E1BEE7",
            "on-secondary-fixed": "#6A1B9A",
            
            "tertiary": "#00838F",
            "on-tertiary": "#ffffff",
            "tertiary-container": "#80DEEA",
            "on-tertiary-container": "#004D40",

            "error": "#E53935",
            "on-error": "#ffffff",
            "error-container": "#FFCDD2",
            "on-error-container": "#B71C1C",

            "background": "#F5F7FA",
            "on-background": "#1A1D21",
            
            "surface": "#ffffff",
            "on-surface": "#1A1D21",
            "surface-variant": "#E0E3E6",
            "on-surface-variant": "#6B7280",
            
            "surface-container-lowest": "#ffffff",
            "surface-container-low": "#F8FAFC",
            "surface-container": "#F1F5F9",
            "surface-container-high": "#E2E8F0",
            "surface-container-highest": "#CBD5E1",
            
            "outline": "#94A3B8",
            "outline-variant": "#CBD5E1",
            
            "inverse-surface": "#1E293B",
            "inverse-on-surface": "#F8FAFC",
            "inverse-primary": "#4DD0E1"
          },
          "borderRadius": {
            "DEFAULT": "0.25rem",
            "lg": "0.5rem",
            "xl": "0.75rem",
            "full": "9999px"
          },
          "spacing": {
            "margin_desktop": "40px",
            "stack_lg": "32px",
            "gutter": "24px",
            "stack_md": "16px",
            "container_max_width": "1440px",
            "sidebar_width": "280px",
            "margin_mobile": "16px",
            "stack_sm": "8px"
          },
          "fontFamily": {
            "headline-md": ["Outfit"],
            "title-lg": ["Inter"],
            "headline-lg": ["Outfit"],
            "headline-lg-mobile": ["Outfit"],
            "label-md": ["Inter"],
            "display-lg": ["Outfit"],
            "body-lg": ["Inter"],
            "body-md": ["Inter"]
          },
          "fontSize": {
            "headline-md": ["24px", { "lineHeight": "1.3", "fontWeight": "600" }],
            "title-lg": ["20px", { "lineHeight": "1.4", "fontWeight": "600" }],
            "headline-lg": ["32px", { "lineHeight": "1.2", "letterSpacing": "-0.01em", "fontWeight": "600" }],
            "headline-lg-mobile": ["24px", { "lineHeight": "1.2", "fontWeight": "600" }],
            "label-md": ["12px", { "lineHeight": "1", "letterSpacing": "0.05em", "fontWeight": "500" }],
            "display-lg": ["48px", { "lineHeight": "1.1", "letterSpacing": "-0.02em", "fontWeight": "700" }],
            "body-lg": ["16px", { "lineHeight": "1.6", "fontWeight": "400" }],
            "body-md": ["14px", { "lineHeight": "1.5", "fontWeight": "400" }]
          }
        }
      }
    };