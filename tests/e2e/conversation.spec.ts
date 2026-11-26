import { expect, test } from "@playwright/test";
import { fakeVoice, spoken } from "./fake-voice";

/**
 * The hands-free flow, end to end. Real speech recognition needs Google's servers, so the page
 * gets a scripted stand-in that "says" each answer word by word and then goes quiet, exactly as
 * the browser API would report it. Everything else (turn-taking, grading, the interviewer's
 * reaction, moving on, the report) is the real app.
 */
const ANSWERS = [
  "Actually I am lying down and attending the interview while my roommate is playing BGMI.",
  "Can you repeat the question?",
  "When I was building my payment project my task was to make checkout reliable. I made the webhook handler idempotent with a unique event id so duplicates are ignored, and as a result double orders stopped completely. That's it.",
  "I would add an index on the columns used in the where clause and check the query plan with explain to confirm the index is used.",
  // After his questions: "Do you have any questions for me?"
  "What does a typical week look like for someone on your team?",
];

test("the interviewer listens, reacts honestly and moves on without any buttons", async ({ page }) => {
  await fakeVoice(page, ANSWERS);

  await page.goto("/");
  await page.getByRole("button", { name: "Start an interview" }).first().click();
  await page.getByRole("button", { name: /Backend Developer/ }).click();
  await page.getByRole("button", { name: "Junior" }).click();
  await page.getByLabel("Number of questions").fill("3");
  await page.getByRole("button", { name: "Start interview" }).click();
  await page.getByRole("button", { name: "Join interview" }).click();

  // He opens like a real interviewer: who he is and what to expect.
  await expect.poll(async () => (await spoken(page))[0] ?? "").toMatch(/^Hi, I'm Arjun\. I lead the platform team/);

  // Turn 1: the unprofessional answer ends by itself and he addresses it in character, with no score shown.
  await expect(page.getByText("Your turn: just talk")).toBeVisible();
  await expect(page.getByText(/lying down/)).toBeVisible();
  await expect.poll(async () => (await spoken(page)).some((l) => /quiet/.test(l)), { timeout: 15_000 }).toBe(true);
  await expect(page.getByText("Quick feedback")).toHaveCount(0);

  // Turn 2: asking for a repeat repeats the question instead of grading the request.
  await expect.poll(async () => (await spoken(page)).some((l) => /^Sure\. /.test(l)), { timeout: 15_000 }).toBe(true);

  // The rest of the interview runs to the report with no clicks at all, ending with him asking for questions.
  await page.waitForURL(/\/report\//, { timeout: 60_000 });
  expect((await spoken(page)).some((l) => /any questions for me\?$/.test(l))).toBe(true);
  // Then, face to face, his honest verdict before the written report.
  const lines = await spoken(page);
  const intro = lines.indexOf("Before you go, I'll give you my honest feedback.");
  expect(intro).toBeGreaterThan(0);
  expect(lines[intro + 1]).toMatch(/^(I'll be straight with you|As it stands, I wouldn't)/);
  await expect(page.getByText("Interview report")).toBeVisible();
  await expect(page.getByText(/Red flag/).first()).toBeVisible();
  // The panel's call: conduct problems cap it, however the other answers went.
  await expect(page.getByLabel("Hiring decision")).toContainText(/No hire/);
  // His reply to the candidate's own question is on the report.
  await expect(page.getByText(/typical week look like/)).toBeVisible();
  await expect(page.getByText(/A typical week is/)).toBeVisible();
});
