<!--
  USER MESSAGE for the Stage B resume screener (Gemini "Message a model" node).
  Paste the block below the divider into the Prompt field (Role: User).

  Pairs with: resume-screen-stageB-system.WIP.md (System Message).
  Set "Output Content as JSON" ON.

  Field references assume the model node's input item has these fields at top
  level (resume, role, department, quality, role_title, seniority_level,
  min_years_experience, location_type, location_or_timezone_constraint,
  compensation_listed, compensation_range, hard_requirements,
  preferred_requirements, key_responsibilities) — exactly the shape you shared.
  If they live on a named upstream node, swap $json for $('That Node').item.json.

  CURRENT_DATE is injected from n8n's clock; nothing else is needed from the
  candidate side here (the resume text carries the contact/location/links).
  The requirement lists may arrive as JSON-encoded strings — that's fine, the
  model reads them as the list of requirements.
-->

CURRENT_DATE: {{ $now.toISODate() }}

JOB (already parsed — authoritative; do not re-derive):
- role_title: {{ $json.role_title }}
- seniority_level: {{ $json.seniority_level }}
- min_years_experience: {{ $json.min_years_experience }}
- location_type: {{ $json.location_type }}
- location_or_timezone_constraint: {{ $json.location_or_timezone_constraint }}
- compensation_listed: {{ $json.compensation_listed }}
- compensation_range: {{ $json.compensation_range }}
- quality: {{ $json.quality }}
- hard_requirements: {{ $json.hard_requirements }}
- preferred_requirements: {{ $json.preferred_requirements }}
- key_responsibilities: {{ $json.key_responsibilities }}
- recruiter_role_label: {{ $json.role }}
- department: {{ $json.department }}

RESUME:
{{ $json.resume }}
