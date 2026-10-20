StatArena
A sports analytics web app covering cricket, tennis, F1, and football, with live scores, player comparison, standings, and AI-generated analysis. The project's main design goal is to keep real data and AI estimates clearly separated.
Live app: https://athlete-arc-keeper.lovable.app
<!-- Add a screenshot of a player page here: ![StatArena player page](docs/player.png) -->
Features
Live scores from ESPN's public scoreboard, refreshed every 30 seconds.
Standings: real tables from ESPN for the Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Champions League, MLS, Eredivisie, and the F1 drivers' and constructors' standings.
Player pages: bio, honours, and recent results from TheSportsDB, plus AI analysis of strengths and weaknesses.
Career trajectory charts: six sport-specific skill ratings per season (for tennis: forehand, backhand, serve, return, movement, mental strength).
Head-to-head comparison between two players.
Real data vs AI estimates
Section	Source	Label in the UI
Live scores	ESPN public scoreboard API	Live data
Standings for the competitions listed above	ESPN	Live data · ESPN
Player bio, honours, recent results	TheSportsDB	none (real data)
Strengths/weaknesses, comparisons, career graphs, major wins, deep stats, event pages, F1 timing tower	Gemini, using the real data above as context	AI estimate
Cricket and tennis standings	Gemini (ESPN has no tables for these)	AI estimate
Every model-generated section carries an "AI estimate" tag. The model can be wrong, because the ratings and narrative come from its training knowledge, anchored by the real data passed in the prompt.
How it works
The browser calls a server function (TanStack Start createServerFn) with the player name and sport.
The server fetches real data from TheSportsDB and ESPN.
It builds a prompt that includes that data plus strict-accuracy instructions and sends it to Google Gemini through the Lovable AI Gateway.
The model's analysis and rating series are returned to the page and rendered with charts.
The AI key lives only in server-side environment secrets, never in browser code.
How it was built
I built StatArena with Lovable and AI assistance. I designed the data flow, decided which sections use real data versus model output, wrote the accuracy instructions, and added the "AI estimate" labels and the ESPN-backed standings after finding that the model's tables could be wrong.
Known limitations
ESPN's endpoint is public but unofficial, and it only provides the current season, so past-season standings are not available.
No cricket or tennis standings source, so those are AI estimates.
AI-generated stats can be inaccurate. Next step: replace them with a paid sports data API and add a spot-check of the model's output against trusted sources.
Author
Riya Bansal, Computer Science at Drexel University. GitHub | LinkedIn
