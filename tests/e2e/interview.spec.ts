import { expect, test } from "@playwright/test";
import { fakeVoice } from "./fake-voice";

const GOOD =
  "When I was building my payment project, my task was to make checkout reliable. First I verified the webhook signature with an HMAC. Then I made the handler idempotent with an idempotency key and a unique constraint on the event id, so duplicates are ignored. I return 200 quickly and retry slow work in a background job. As a result we stopped double orders and errors fell by 40 percent.";

test("guest can complete a full interview by voice and see a report", async ({ page }) => {
  await fakeVoice(page, Array(8).fill(GOOD));
  await page.goto("/");
  await page.getByRole("button", { name: "Start an interview" }).first().click();
  await expect(page).toHaveURL(/\/interview\/new/);

  await page.getByRole("button", { name: /Backend Developer/ }).click();
  await page.getByRole("button", { name: "Junior" }).click();
  await page.getByLabel("Number of questions").fill("3");
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page).toHaveURL(/\/interview\/[0-9a-f-]{36}$/);

  await page.getByRole("button", { name: "Join interview" }).click();

  // Voice only: no typing box and no repeat button, and the interview runs to the report by itself.
  await expect(page.getByText("Your turn: just talk")).toBeVisible();
  await expect(page.getByLabel("Your answer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Type instead|Repeat question/ })).toHaveCount(0);
  await page.waitForURL(/\/report\//, { timeout: 90_000 });
  await expect(page.getByLabel("Hiring decision")).toBeVisible();
  await expect(page.getByText("Interview report")).toBeVisible();
  await expect(page.getByText("Answer by answer")).toBeVisible();
  await expect(page.getByRole("img", { name: /Overall score \d+ out of 100/ })).toBeVisible();
  // Delivery is shown as readings on rulers with the target band, not stat cards.
  await expect(page.getByRole("heading", { name: "Readings" })).toBeVisible();
  await expect(page.getByRole("img", { name: /^Filler words: [\d.]+%, target 0 to 2%, (within|outside) the target$/ })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByText("Interviews completed")).toBeVisible();
  // The practice log plots the interview as a point against the hiring bar, linked to its report,
  // and lists it as a ruled entry.
  await expect(page.getByRole("link", { name: /^Backend Developer, Junior, .*: \d+ against a bar of 60\. Open the report\.$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Backend Developer Junior/ })).toBeVisible();
  await expect(page.getByRole("group", { name: /cleared the hiring bar for their level/ })).toBeVisible();

  // The skill map estimates each topic from the answers, and offers a targeted session.
  await expect(page.getByRole("heading", { name: "Skill map" })).toBeVisible();
  await expect(page.getByRole("img", { name: /about \d+%, likely between \d+ and \d+/ }).first()).toBeVisible();
  const practise = page.getByRole("button", { name: "Practise my weak spots" });
  if (await practise.isVisible()) {
    await practise.click();
    await expect(page).toHaveURL(/\/interview\/[0-9a-f-]{36}$/);
  }
});

test("protected pages redirect to sign in, and accounts work end to end", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);

  const email = `e2e-${Date.now()}@example.com`;
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Test User");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("8 characters");
  await page.getByLabel("Password").fill("a-long-password");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Hi Test")).toBeVisible();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL("/");
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("main [role=alert]")).toContainText("incorrect");
  await page.getByLabel("Password").fill("a-long-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);

  // Starting from the home page while signed in keeps the account (it used to swap in a guest).
  await page.goto("/");
  await page.getByRole("button", { name: "Start an interview" }).first().click();
  await expect(page).toHaveURL(/\/interview\/new/);
  await page.goto("/dashboard");
  await expect(page.getByText("Hi Test")).toBeVisible();
});

test("users cannot read each other's interviews", async ({ browser, request }) => {
  const a = await browser.newContext();
  const pa = await a.newPage();
  await pa.goto("/");
  await pa.getByRole("button", { name: "Start an interview" }).first().click();
  await expect(pa).toHaveURL(/\/interview\/new/);
  const res = await pa.request.post("/api/interviews", { data: { role: "security", level: "mid", focus: "technical", totalQuestions: 3 } });
  expect(res.status()).toBe(201);
  const { id } = await res.json();

  const other = await request.post("/api/auth/guest");
  expect(other.status()).toBe(201);
  const peek = await request.get(`/api/interviews/${id}`);
  expect(peek.status()).toBe(404);
  await a.close();
});

test("api validates input", async ({ request }) => {
  await request.post("/api/auth/guest");
  const bad = await request.post("/api/interviews", { data: { role: "chef", level: "junior", focus: "mixed", totalQuestions: 5 } });
  expect(bad.status()).toBe(400);
  const unauth = await (await (await import("@playwright/test")).request.newContext({ baseURL: test.info().project.use.baseURL })).get("/api/interviews");
  expect(unauth.status()).toBe(401);
});

test("browsers that can't listen are told to switch, not offered a typing fallback", async ({ page }) => {
  await page.addInitScript(() => {
    delete (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    delete (window as unknown as Record<string, unknown>).SpeechRecognition;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start an interview" }).first().click();
  await page.getByRole("button", { name: /Backend Developer/ }).click();
  await page.getByRole("button", { name: "Start interview" }).click();
  await expect(page.getByText(/voice only, and this browser can't listen/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Join interview" })).toBeDisabled();
});
