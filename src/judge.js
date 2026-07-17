'use strict';

const { callProvider } = require('./providers');
const { hashContent } = require('./util');

const FAILURE_MODES = [
  'Hallucination',
  'Instruction Non-Compliance',
  'Format/Schema Violation',
  'Incomplete Answer',
  'Unwarranted Refusal',
  'Reasoning Error',
  'Tool-Use Error',
  'Off-Topic',
  'Style/Verbosity',
  'Other',
  'None',
];

const JUDGE_SYSTEM_PROMPT = `You are a rigorous, adversarial evaluation judge for an LLM eval harness. You will be given an INPUT, an optional REFERENCE answer, optional CRITERIA, and the actual OUTPUT produced by the system under test.

Grade the OUTPUT strictly against the REFERENCE and/or CRITERIA. If both are present, treat CRITERIA as authoritative. Do not reward confident tone, verbosity, or superficial resemblance to the reference. Penalize hallucinated facts, unmet constraints, and format violations even when the overall answer "sounds right." When uncertain between two adjacent scores, choose the lower one.

Respond with ONLY a raw JSON object — no markdown fences, no commentary before or after — in exactly this shape:
{"pass": boolean, "score": integer 1-5, "failureMode": string, "rationale": string}

Scoring guide:
5 = fully correct and complete, meets every stated criterion
4 = correct with a minor omission or style issue, no factual errors
3 = partially correct — a meaningful gap or one factual error
2 = mostly incorrect or violates a key constraint
1 = wrong, hallucinated, non-responsive, or unsafe

"pass" is true only for scores of 4 or 5.
"failureMode" must be exactly one of: Hallucination, Instruction Non-Compliance, Format/Schema Violation, Incomplete Answer, Unwarranted Refusal, Reasoning Error, Tool-Use Error, Off-Topic, Style/Verbosity, Other, None. Use "None" only when score is 4 or 5.
"rationale" must be one or two sentences, specific and evidence-based — point to the exact issue, not a vague impression.`;

// judgeEntry/judgeKey identify a FIXED provider used as grader for an entire run. Keeping the judge
// constant across compared runs is what makes regression diffs valid — if the grader itself drifted
// between runs, score deltas would be confounded by judge drift, not just system-under-test changes.
async function judgeCase(workspace, judgeEntry, judgeKey, testCase, output, useCache) {
  const cacheKey = 'judge-' + hashContent(JSON.stringify({
    judge: judgeEntry.id + ':' + judgeEntry.model,
    input: testCase.input,
    expected: testCase.expected,
    criteria: testCase.criteria,
    output,
  }));

  if (useCache !== false) {
    const cached = workspace.cacheGet(cacheKey);
    if (cached) return Object.assign({}, cached, { cached: true });
  }

  const parts = [
    `INPUT:\n${testCase.input}`,
    testCase.expected ? `REFERENCE:\n${testCase.expected}` : null,
    testCase.criteria ? `CRITERIA:\n${testCase.criteria}` : null,
    `OUTPUT:\n${output}`,
  ].filter(Boolean);
  const userMsg = parts.join('\n\n');

  const raw = await callProvider(judgeEntry, judgeKey, JUDGE_SYSTEM_PROMPT, userMsg);
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  let result;
  try {
    const parsed = JSON.parse(cleaned);
    const scoreNum = Math.round(Number(parsed.score));
    const score = Math.max(1, Math.min(5, isNaN(scoreNum) ? 1 : scoreNum));
    const pass = score >= 4;
    let failureMode = FAILURE_MODES.indexOf(parsed.failureMode) !== -1 ? parsed.failureMode : (pass ? 'None' : 'Other');
    if (pass) failureMode = 'None';
    result = { pass, score, failureMode, rationale: String(parsed.rationale || '').slice(0, 500) };
  } catch (e) {
    result = { pass: false, score: null, failureMode: null, rationale: '', judgeError: true, raw: cleaned.slice(0, 300) };
  }

  if (useCache !== false && !result.judgeError) workspace.cacheSet(cacheKey, result);
  return result;
}

function buildRun(opts) {
  const { uid } = require('./util');
  const results = opts.results;
  const scored = results.filter((r) => !r.judgeError);
  const errored = results.length - scored.length;
  const total = scored.length;
  const passed = scored.filter((r) => r.pass).length;
  const avgScoreRaw = total ? scored.reduce((a, r) => a + (r.score || 0), 0) / total : 0;
  const failureModeCounts = {};
  scored.forEach((r) => {
    const fm = r.failureMode || 'None';
    failureModeCounts[fm] = (failureModeCounts[fm] || 0) + 1;
  });
  return {
    id: uid('run'),
    testsetName: opts.testsetName,
    label: opts.label || 'unlabeled',
    mode: opts.mode,
    provider: opts.provider,
    judgeProvider: opts.judgeProvider,
    systemPrompt: opts.systemPrompt || null,
    timestamp: Date.now(),
    aborted: !!opts.aborted,
    results,
    summary: {
      total,
      passed,
      passRate: total ? Math.round((passed / total) * 100) : 0,
      avgScore: Math.round(avgScoreRaw * 100) / 100,
      failureModeCounts,
      errored,
    },
  };
}

module.exports = { JUDGE_SYSTEM_PROMPT, FAILURE_MODES, judgeCase, buildRun };

