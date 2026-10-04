-- Optional Trip Builder / PDF branding for migration 015_trip_builder_flow.sql.
-- NOT a migration — db push ignores this folder.
--
-- Run by hand in SQL Editor only when you want starter branding in that DB
-- (typically local/staging). Live should use confirmed brand assets/colors.
--
-- Depends on: company_settings from 011_rate_layer.sql (or earlier).

INSERT INTO public.company_settings (key, value)
VALUES (
  'pdf_branding',
  '{
    "company_display_name": "PureLuxe",
    "logo_path": null,
    "logo_dark_path": null,
    "colors": {
      "primary": "#1a4d3e",
      "ink": "#141414",
      "paper": "#f4f1ea"
    },
    "font_display": "Cormorant Garamond",
    "font_body": "DM Sans",
    "letterhead": null,
    "footer_text": null
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
