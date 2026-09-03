# Life Backtest — team development rules

- Read README.md and docs/TEAM_HANDOFF.md before changing the game. This folder is the repository root.
- Preserve the continuous playable route: shore → lunar rewind → archive registration/review → player walks through the open door → whiteout → lunar garden.
- Do not add a marketing landing page in front of the game or replace the existing renderer/framework without agreement.
- Keep the monochrome authored pixel-game style, original player identity, and sparse Zero Miss dialogue. Do not bake live UI/player text into scene backgrounds.
- The approved door version is a compatibility boundary. Do not redesign the door, opening direction or timing as part of unrelated work.
- Current player facts, target age, selected age and calendar year are distinct. Never infer a birth year or past family/employment facts from current age alone.
- Real sources, inference, simulation and player-entered text must be distinguished. The teammate content model is NOT yet connected; do not fabricate real people, quotes or matching scores.
- Browser profile and notes stay local unless the player explicitly agrees to send the necessary fields. Never put service secrets in frontend code or commit browser state.
- Read docs/INTEGRATION.md for existing events and proposed service boundaries; proposed endpoints are not implemented APIs.
- After changes run pnpm verify and pnpm test:e2e. Review screenshots of first action, mid-action, resolved state and recovery at desktop and narrow sizes.
- Do not reset or overwrite existing remote history to upload this project. Confirm repository URL, branch and visibility first.

If the original workspace Game Studio skills are available, use life-backtest-game-director, game-studio and the relevant specialist. A teammate checkout does not require Codex or those external skills to run or test.
