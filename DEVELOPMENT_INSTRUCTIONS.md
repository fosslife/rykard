# Development Instructions

## General Guidelines

1. Focus on one feature at a time
2. Get user approval before moving to the next feature
3. Maintain clean, modern UI design
4. Ensure proper error handling
5. Write clear documentation

## Rust Development

1. **ALWAYS run `cargo check` after making changes to Rust code to catch errors early**
2. Be careful with Bollard API as it may have changed since documentation was written
3. Handle Option types properly in Rust code
4. When in doubt, use the Command approach to execute Docker CLI commands directly
5. Prefix unused variables with underscore to avoid warnings

## Frontend Development

1. Use Tailwind CSS for styling
2. Import Tauri invoke from `@tauri-apps/api/core` (not from `/tauri`)
3. Check with the user before adding any new libraries or plugins
4. Leave a blank line before return statements
5. Use shadcn/ui components for UI elements
6. Use motion/react for animations (import as: `import { motion } from "motion/react"`)

## UI Improvements

1. Implement a cleaner, more modern UI with subtle animations
2. Use consistent color scheme and component styling
3. Add proper transitions between views
4. Improve responsive design for different screen sizes

## Future Improvements

1. Add react-router for better navigation and URL-based routing
2. Implement dark/light theme toggle
3. Add keyboard shortcuts for common actions
4. Implement better error handling and notifications

## Project Management

1. Update the PROJECT_PLAN.md file after completing each feature
2. Mark features as completed with [x] in the project plan
3. Keep track of current phase, completed features, in-progress features, and next features
