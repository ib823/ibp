export interface TourStep {
  target: string | null;
  title: string;
  body: string;
  route: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    target: null,
    title: 'Welcome to the PETROS Integrated Planning System',
    body: "This application evaluates the economics of oil, gas, and carbon storage projects under Malaysia's Production Sharing Contract fiscal regimes. It combines production forecasting, fiscal modeling, financial statements, reserves management, and probabilistic analysis in a single platform.\n\nYou don't need any prior petroleum industry knowledge \u2014 every concept is explained as you go. Click 'Next' to start the tour, or 'Skip' to explore on your own. You can restart this tour anytime from Settings or the \u24D8 icon.",
    route: '/',
  },
  {
    target: "[data-tour='dashboard-kpis']",
    title: 'Your Portfolio at a Glance',
    body: "These four cards summarize the health of your entire project portfolio:\n\n\u2022 Portfolio NPV\u2081\u2080 \u2014 total value created (or destroyed) across all projects\n\u2022 Total CAPEX \u2014 total investment required\n\u2022 Weighted IRR \u2014 portfolio-level return rate\n\u2022 Active Projects \u2014 how many projects are included\n\nGreen numbers are favorable; red indicate areas of concern.",
    route: '/',
  },
  {
    target: "[data-tour='scenario-selector']",
    title: 'Test Different Futures',
    body: "Oil and gas prices are volatile. The Scenario Selector lets you instantly switch between four price assumptions \u2014 High, Base, Low, and Stress \u2014 and watch every number, chart, and table update.\n\nTry it now: select 'High Case' and watch the Portfolio NPV change. Then switch back to 'Base Case' to continue.",
    route: '/',
  },
  {
    target: "[data-tour='economics-inputs']",
    title: 'Deep-Dive into a Single Project',
    body: "The Economics page evaluates individual projects. Select a project from the dropdown, view its production and cost inputs on the left, and see the full results \u2014 NPV, IRR, Payback, and Profitability Index \u2014 on the right.\n\nYou can edit any input and click 'Calculate' to instantly see how changes affect the project's value. This is 'what-if' analysis \u2014 the heart of petroleum economics.",
    route: '/economics',
  },
  {
    target: "[data-tour='fiscal-waterfall']",
    title: 'How Revenue Gets Shared \u2014 The PSC Waterfall',
    body: "This is the most important chart in the application. It shows the lifecycle journey of every dollar of revenue through Malaysia's Production Sharing Contract system.\n\nStarting from Gross Revenue, each bar is a deduction: Royalty (10%), Export Duty (10%), PETRONAS's profit share, PITA Tax (38%), and costs. What remains is the Contractor's Net Cash Flow.\n\nHover over each bar to see the exact amount and explanation.",
    route: '/economics',
  },
  {
    target: "[data-tour='economics-inputs']",
    title: 'What-If Analysis \u2014 Change the Inputs',
    body: "Try changing the Total CAPEX and clicking 'Calculate.' Watch how a cost reduction flows through the entire fiscal model \u2014 affecting cost recovery, profit split, tax, and ultimately NPV and IRR.\n\nThis is how petroleum economists evaluate development options: 'What if we drill fewer wells?' 'What if we use a simpler platform?' Every change cascades through the PSC fiscal waterfall.",
    route: '/economics',
  },
  {
    target: "[data-tour='sensitivity-page']",
    title: 'Which Variables Matter Most?',
    body: "The Sensitivity page answers: 'If my assumptions are wrong, which ones matter most?'\n\nThe Tornado chart varies each input by \u00B130% and ranks them by impact on NPV. The widest bar is the most sensitive variable \u2014 the one to focus on managing.\n\nTry the Spider tab for continuous sensitivity, or Scenario Comparison for all four price cases side by side.",
    route: '/sensitivity',
  },
  {
    target: "[data-tour='portfolio-toggles']",
    title: 'Build Your Optimal Portfolio',
    body: "Toggle projects on and off to see their incremental impact on the portfolio. This is portfolio optimization \u2014 finding the best combination within your capital budget.\n\nTry toggling off 'SK-612 Deepwater Exploration' (which has a large negative NPV) and watch the Portfolio NPV improve dramatically. This tells you excluding or deferring that project would improve the portfolio.",
    route: '/portfolio',
  },
  {
    target: "[data-tour='financial-tabs']",
    title: 'From Economics to Accounting',
    body: "The Financial page translates the economic model into standard accounting statements: Income Statement (profitability), Balance Sheet (financial position), Cash Flow (actual cash movements), and Account Movements (audit trail).\n\nEvery number traces back to the Economics page inputs. The Account Movements tab shows the roll-forward schedules that auditors require.",
    route: '/financial',
  },
  {
    target: "[data-tour='reserves-table']",
    title: 'How Much Oil and Gas Remains?',
    body: "Reserves are the foundation of everything. This page shows estimated recoverable volumes classified by the SPE PRMS standard: 1P (90% confidence), 2P (best estimate, 50%), and 3P (including upside, 10%).\n\nScroll down for the Reserves Reconciliation Waterfall \u2014 an annual accounting of how reserves changed (discoveries, revisions, production consumed).\n\nFor the CCS project, CO\u2082 storage capacity is classified under the SPE SRMS standard.",
    route: '/reserves',
  },
  {
    target: "[data-tour='montecarlo-config']",
    title: 'Embrace Uncertainty',
    body: "Instead of a single NPV answer, Monte Carlo simulation gives you the full range of possible outcomes. It runs the model 1,000 times with randomly varied prices, production, and costs.\n\nThe histogram shows the distribution. The S-curve lets you read probabilities. P(NPV > 0) tells you the chance the project creates value \u2014 the most decision-relevant number.\n\nTry clicking 'Run Simulation' with seed 42 to see reproducible results.",
    route: '/monte-carlo',
  },
  {
    target: "[data-tour='export-excel']",
    title: 'Download and Verify',
    body: "Every economics result can be exported to Excel for independent verification. This is critical for audit and governance \u2014 stakeholders can check the fiscal model against manual calculations.\n\nThat completes the tour! You now understand petroleum economics, Malaysian fiscal regimes, and portfolio analysis. Click any \u2139\uFE0F icon for detailed explanations, or visit the Glossary (in the sidebar) for definitions.\n\nWelcome to the PETROS Integrated Planning System.",
    route: '/economics',
  },
];
