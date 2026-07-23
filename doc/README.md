# SAROps

SAROps is a Progressive Web App for emergency services incident management. This repository contains the initial MVP scaffold and specification notes for a React + PWA application that will sync with Supabase and local SQLite via PowerSync.

## Project status
- Initial project created
- Architecture and goals captured in `SAROps-spec.md`
- React + Vite scaffold ready for development

## Development

Install frameworks, start services, install npm dependencies
```bash
cd SAROps/scripts
SAROPs-Install.sh
SAROPs-Start-Services.sh
cd ..
npm install
reinit-db.sh
```

Run locally:

```bash
npm run dev
```

## Notes
Use `SAROps-spec.md` to capture evolving application design, data models, and sync architecture.
