/**
 * Workshop Email Templates
 *
 * Default email templates for educational workshop system.
 * Admins can customize these per-workshop via the admin dashboard.
 *
 * All templates include:
 * - Subject line
 * - Preheader text (preview text shown in email client)
 * - Body content (supports both plain text format shown here and HTML rendering)
 *
 * Template tags are replaced at send-time with actual user/workshop data.
 */

/**
 * Email template structure
 */
export interface WorkshopEmailTemplate {
  subject: string;
  preheader: string;
  body: string;
}

/**
 * Email types in the workshop sequence
 */
export type EmailType =
  | 'welcome'        // Email 1: Sent immediately after signup
  | 'reminder'       // Email 2: Sent 24h before workshop (admin-configurable)
  | 'week1'          // Email 3: Following the Trail (2h after workshop, admin-configurable)
  | 'week2'          // Email 4: Seeing the Whole Picture (7 days after Email 3)
  | 'week3'          // Email 5: Now We're Talking (7 days after Email 4)
  | 'week4'          // Email 6: Making My Move (7 days after Email 5)
  | 'wrapup';        // Email 7: Different Now (7 days after Email 6, 30-day wrap-up)

/**
 * Available template tags for dynamic content replacement
 *
 * These tags are replaced with actual data when emails are sent.
 * Admins can insert these tags via buttons in the WYSIWYG editor.
 */
export const TEMPLATE_TAGS = {
  firstName: '{{firstName}}',
  workshopName: '{{workshopName}}',
  workshopDate: '{{workshopDate}}',
  workshopTime: '{{workshopTime}}',
  workshopLocation: '{{workshopLocation}}',
  accessGrantDate: '{{accessGrantDate}}',
  trialStartDate: '{{trialStartDate}}',
  trialDurationDays: '{{trialDurationDays}}',
  charityName: '{{charityName}}',
  loginUrl: '{{loginUrl}}',
} as const;

/**
 * Template tag descriptions for admin UI
 */
export const TEMPLATE_TAG_DESCRIPTIONS: Record<keyof typeof TEMPLATE_TAGS, string> = {
  firstName: "User's first name",
  workshopName: 'Cohort name',
  workshopDate: 'Workshop date (formatted)',
  workshopTime: 'Workshop time with timezone(s)',
  workshopLocation: 'Physical address or Zoom link',
  accessGrantDate: 'When platform access unlocks',
  trialStartDate: 'When trial begins',
  trialDurationDays: 'Length of trial in days',
  charityName: "User's selected charity",
  loginUrl: 'Link to login page',
};

// =============================================================================
// DEFAULT EMAIL TEMPLATES
// =============================================================================
//
// These are the default templates used when admin doesn't customize.
// Content from: Roadmaps/EDUCATIONAL_WORKSHOP_SYSTEM_ROADMAP.md (Phase 5, E1)
// Original source: cpg/docs/audacious-money-email-sequence.md
//
// NOTE: Admins have full editing access via rich text WYSIWYG editor.
// Emails are sent as HTML with full formatting (not plain text).
// =============================================================================

/**
 * Email 1: Welcome Email
 * Sent immediately after signup
 */
const WELCOME_EMAIL: WorkshopEmailTemplate = {
  subject: '[AM] IN! Here\'s your first steps',
  preheader: 'A little prework, one product, and a promise about your recipes',
  body: `Hey {{firstName}},

Welcome — I am so glad you're here!

Good on you for signing up and leaning into the part most entrepreneurs avoid: the numbers 😬

Here is what I want you to know before we begin — you are wildly capable. You don't have to become a different person to understand your business. You just need a little guidance and a place that feels safe enough to be honest.

So let's get you ready.

**Before class, there's about an hour of prework.** It isn't busywork — it is the foundation everything else sits on. Here's what it looks like:

1. **Pick ONE product.** Just one. Your bestseller, your favorite, or the one you are most curious (or most nervous) about. We're going to follow it all the way through.
2. **Gather your invoices & receipts.** Ingredients, packaging, labels — whatever goes into that one product. Recent ones, so we're working off today's prices, not last year's.
3. **Fill out the worksheet.** We'll walk you through your product's information line by line. No accounting degree required, I promise.
4. **Add your invoices.** Put them in so your costs reflect what you're actually paying now.

→ **Have this complete by the beginning of the workshop.**

{{loginUrl}}

Log in to pick up where you left off.

**Now, about your recipes.** I know your formulations are sacred — they are the heart of everything you have built. So let me be completely clear: this software is *zero-knowledge*. Your recipes, your invoices, your numbers are encrypted in a way that even I cannot see them. Not me. Not anyone. I'm a true believer in sovereignty — your business is yours and your data belongs to you and only you.

One more thing — and this one's just for fun:

Before we get into the software, what do you *think* it costs you to make one unit of that product right now? Go with what you currently know to be true. **Hit reply and send me your number.**

Once your worksheet is done, you'll land on the **countdown page** — it'll tick down to {{workshopDate}} for our workshop and when the full app opens up for you.

That's it. One product. A few invoices. Your current number. You've got this.

See you {{workshopDate}},
Audrey
*Audacious Money*

**P.S.** If anything feels stuck or unclear, just reply to this email. A real human (me) is on the other end.

---

Your chosen charity: {{charityName}}
Audacious Money will contribute: $5/mo (starts after {{trialDurationDays}}-day free trial)`,
};

/**
 * Email 2: Workshop Reminder
 * Sent 24 hours before workshop (admin-configurable)
 */
const REMINDER_EMAIL: WorkshopEmailTemplate = {
  subject: '[AM] Ready for tomorrow?',
  preheader: 'What to expect and what to bring',
  body: `Hey {{firstName}},

Tomorrow is the day. ✨

In about 24 hours, we are getting together to connect you deeper with your business — and I cannot wait.

A tiny checklist so you walk in ready:

- ✅ **Your worksheet is complete** — one product, invoices added. If it's not quite finished, that's okay. Do what you can. → **[Finish your worksheet]** {{loginUrl}}
- ✅ **Your laptop is charged and connects to WiFi.** This is hands-on — you'll have your product clarity on screen *and* in hand.
- ✅ **You've brought yourself, exactly as you are.**

📅 {{workshopDate}} at {{workshopTime}}
📍 {{workshopLocation}}

Can't wait to get a little curious (and maybe a little uncomfortable — that's where the good stuff lives).

Remember: your numbers are the language your business has been speaking to you this whole time. Tomorrow, we start listening together.

There is liberation in knowledge that can't be expressed until it's felt. Come ready to feel it.

See you in the morning,
Audrey

**P.S.** Didn't get to that initial cost number question yet? Hit reply and send it now.`,
};

/**
 * Email 3: Week 1 - Following the Trail
 * Sent 2 hours after workshop ends (admin-configurable)
 */
const WEEK1_EMAIL: WorkshopEmailTemplate = {
  subject: '[AM] Following the Trail',
  preheader: 'Get curious and just notice everything',
  body: `HEYO!

Am I just nerdy or was that a great workshop - thank you for joining us! 🌸

Now the real magic begins: 30 days of small, intentional steps. Not a big, overwhelming overhaul. Just one focused move each week. (This is exactly how lasting change actually forms — tiny and consistent beats heroic and unsustainable, every time.)

**This week: follow ONE product, start to finish.**

Take the product we worked with — and this time, watch it move through it's cycle to bring it to life. From raw materials all the way to your customer's hands. As you go, just notice:

- How much **time** it actually takes you (mixing, packaging, labeling — all of it)
- Every **touchpoint** it passes through on its way to a customer

You're not fixing anything yet. You're just paying attention. Awareness first. Always.

Here's your question for the week:

**How many separate touchpoints did your product pass through before it reached your customer? Reply with just the number**

I read every reply - the language of numbers is beautiful in all it's forms.

Talk soon,
Audrey

**P.S.** Presence, not performance. There is no wrong number here — there's just what is true.`,
};

/**
 * Email 4: Week 2 - Seeing the Whole Picture
 * Sent 7 days after Email 3 (admin-configurable)
 */
const WEEK2_EMAIL: WorkshopEmailTemplate = {
  subject: '[AM] Seeing the Whole Picture',
  preheader: 'The math is done - here\'s what to do with what you found',
  body: `Hey {{firstName}},

Last week you watched your product travel. This week, we put a number on it.

**This week: update the complete cost per unit in the software**

Not just materials. The whole truth:

> **Materials + Labor (your time has value) + Distribution (the journey to your customer)**

Most entrepreneurs are stunned by one part in particular — and for so many, it's their own labor. Your time is one of your largest costs, even (*especially*) when you're the one doing the work. So count it. If your business grew, you'd have to pay someone to do this, right? That's the number.

This is the moment your business stops being a mystery and starts being yours.

And here's your question:

**Remember your number from Day 1? What are you seeing now that you've done the math? Hit reply and tell me.**

I genuinely want to know — and there's no judgment in either direction. It is just information. Beautiful, useful information.

Cheering you on,
Audrey`,
};

/**
 * Email 5: Week 3 - Now We're Talking
 * Sent 7 days after Email 4 (admin-configurable)
 */
const WEEK3_EMAIL: WorkshopEmailTemplate = {
  subject: '[AM] Now We\'re Talking',
  preheader: 'Your number, your price and what your business is telling you',
  body: `Hey {{firstName}},

You know your number now and going at this with your eyes wide open.

That's game changer energy, my friend.

This week, we put it next to your price.

**This week: compare your complete cost to what you're currently charging.**

That's it. Line them up and look. What you see is your business telling you something specific — not a judgment, not a grade. Just a signal. And now you speak the language, so you can actually hear it.

Some of what you find will feel like momentum. Some of it might point to your next move. Either way, you earned this clarity — and clarity is where confident decisions are made.

Here's your question:

**What is your cost per unit telling you right now? Hit reply with one word.**

One word. I'll know exactly what you mean.

Still cheering,
Audrey`,
};

/**
 * Email 6: Week 4 - Making My Move
 * Sent 7 days after Email 5 (admin-configurable)
 */
const WEEK4_EMAIL: WorkshopEmailTemplate = {
  subject: '[AM] Making My Move',
  preheader: 'One decision',
  body: `Hi {{firstName}},

You've watched. You've calculated. You've listened. Now we move.

**This week: make ONE informed decision.**

Just one. You don't have to overhaul everything — that's how people burn out and abandon the whole thing. One decision, made on purpose, is how real change actually sticks.

It could be:

- Adjusting a price
- Focusing on the channel that actually serves you
- Streamlining one part of your process
- Saying a respectful *"no"* to an opportunity that doesn't fit

Saying yes to what serves your goals — and no to what doesn't — isn't being difficult. It's being intentional. That's the whole point.

Your question this week is really a commitment:

**What is the ONE decision you're making this week — and *when exactly* will you make it? Reply and put it in writing.**

Saying it out loud (or typing it to me) makes it real. So hit reply, tell me your decision and your day, and I'll be in your corner when it happens.

Proud of you,
Audrey`,
};

/**
 * Email 7: 30-Day Wrap-Up (Different Now)
 * Sent 7 days after Email 6 (admin-configurable)
 */
const WRAPUP_EMAIL: WorkshopEmailTemplate = {
  subject: '[AM] Different Now',
  preheader: '30 days. One product. A whole new way of seeing your business',
  body: `Hey {{firstName}},

Thirty days ago you showed up - for your numbers, for your buisness, for yourself.

And you did the work.

You followed one product all the way through. You learned what it actually costs to make it.

You lined up your price and looked it in the eye. And then you made a decision - on purpose, with clarity - because now you speak the language.

So here's my favorite question of this entire journey:

**What feels different now? Hit reply and let me know** 🌸

I read every single one.

And one more thing on a more personal note - because you've spent 30 days inside this software, your experience matters more to me than almost anyone else's right now:

**What would make this tool work even harder for you and your business?**

I'm actively building and I want to build it for *you*. No suggestion is too small or too bold. Hit reply and tell me that too.

Thank you for trusting this process - and for trusting me with your numbers. It's not lost on me what that takes.

Money matters, but the heart counts.. here's to knowing your worth, my friend.

Audrey *Audacious Money*

**P.S.** This was never about becoming perfect with your numbers. It was about becoming *connected* to them. And you did exactly that. 🌸

---

**Continue Your Journey:**

Your {{trialDurationDays}}-day free trial ends soon. To keep building on this foundation and supporting {{charityName}}, upgrade to $20/month:

✓ Full access to all features
✓ Unlimited transactions and reports
✓ $5/month donated to {{charityName}}
✓ Ongoing support and updates

[Upgrade Now] {{loginUrl}}`,
};

// =============================================================================
// EMAIL TEMPLATE REGISTRY
// =============================================================================

/**
 * All default email templates mapped by type
 */
const DEFAULT_TEMPLATES: Record<EmailType, WorkshopEmailTemplate> = {
  welcome: WELCOME_EMAIL,
  reminder: REMINDER_EMAIL,
  week1: WEEK1_EMAIL,
  week2: WEEK2_EMAIL,
  week3: WEEK3_EMAIL,
  week4: WEEK4_EMAIL,
  wrapup: WRAPUP_EMAIL,
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Get default email template by type
 *
 * @param emailType - Type of email template to retrieve
 * @returns Email template with subject, preheader, and body
 *
 * @example
 * const welcomeTemplate = getDefaultEmailTemplate('welcome');
 * console.log(welcomeTemplate.subject); // "[AM] IN! Here's your first steps"
 */
export function getDefaultEmailTemplate(emailType: EmailType): WorkshopEmailTemplate {
  return DEFAULT_TEMPLATES[emailType];
}

/**
 * Get all default email templates
 *
 * @returns All 7 email templates keyed by type
 *
 * @example
 * const allTemplates = getAllDefaultTemplates();
 * console.log(Object.keys(allTemplates)); // ['welcome', 'reminder', 'week1', ...]
 */
export function getAllDefaultTemplates(): Record<EmailType, WorkshopEmailTemplate> {
  return { ...DEFAULT_TEMPLATES };
}

/**
 * Replace template tags in a string with actual values
 *
 * This function is used by the email rendering service to replace
 * template tags like {{firstName}} with actual user data.
 *
 * @param template - String containing template tags
 * @param variables - Key-value pairs to replace (without {{ }})
 * @returns String with all template tags replaced
 *
 * @example
 * const template = "Hey {{firstName}}, welcome to {{workshopName}}!";
 * const result = replaceTemplateTags(template, {
 *   firstName: "Sarah",
 *   workshopName: "Understanding Your Costs"
 * });
 * console.log(result); // "Hey Sarah, welcome to Understanding Your Costs!"
 */
export function replaceTemplateTags(
  template: string,
  variables: Record<string, string>
): string {
  let result = template;

  for (const [key, value] of Object.entries(variables)) {
    // Replace all occurrences of {{key}} with value
    const placeholder = `{{${key}}}`;
    result = result.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
  }

  return result;
}

/**
 * Get list of all available template tags
 *
 * Useful for admin UI to show available tags in the editor.
 *
 * @returns Array of template tag names (without {{ }})
 *
 * @example
 * const tags = getAvailableTemplateTags();
 * console.log(tags); // ['firstName', 'workshopName', 'workshopDate', ...]
 */
export function getAvailableTemplateTags(): string[] {
  return Object.keys(TEMPLATE_TAGS);
}

/**
 * Validate that a template doesn't use undefined tags
 *
 * Checks if template contains only valid template tags.
 * Returns array of invalid tags found (empty if all valid).
 *
 * @param template - Template string to validate
 * @returns Array of invalid tag names (empty if valid)
 *
 * @example
 * const invalid = validateTemplateTags("Hello {{firstName}} {{invalidTag}}");
 * console.log(invalid); // ['invalidTag']
 */
export function validateTemplateTags(template: string): string[] {
  // Find all {{...}} patterns in template
  const tagPattern = /\{\{([^}]+)\}\}/g;
  const foundTags = new Set<string>();
  const invalidTags: string[] = [];

  let match;
  while ((match = tagPattern.exec(template)) !== null) {
    const tagName = match[1].trim();
    foundTags.add(tagName);
  }

  // Check if each found tag is valid
  const validTags = new Set(Object.keys(TEMPLATE_TAGS));
  for (const tag of foundTags) {
    if (!validTags.has(tag)) {
      invalidTags.push(tag);
    }
  }

  return invalidTags;
}

/**
 * Get email sequence description for admin reference
 *
 * @returns Array of email descriptions with timing information
 */
export function getEmailSequenceDescription(): Array<{
  type: EmailType;
  name: string;
  timing: string;
  subject: string;
}> {
  return [
    {
      type: 'welcome',
      name: 'Welcome Email',
      timing: 'Sent immediately after signup',
      subject: WELCOME_EMAIL.subject,
    },
    {
      type: 'reminder',
      name: 'Workshop Reminder',
      timing: 'Sent 24 hours before workshop (admin-configurable)',
      subject: REMINDER_EMAIL.subject,
    },
    {
      type: 'week1',
      name: 'Week 1 - Following the Trail',
      timing: 'Sent 2 hours after workshop ends (admin-configurable)',
      subject: WEEK1_EMAIL.subject,
    },
    {
      type: 'week2',
      name: 'Week 2 - Seeing the Whole Picture',
      timing: 'Sent 7 days after Email 3 (admin-configurable)',
      subject: WEEK2_EMAIL.subject,
    },
    {
      type: 'week3',
      name: 'Week 3 - Now We\'re Talking',
      timing: 'Sent 7 days after Email 4 (admin-configurable)',
      subject: WEEK3_EMAIL.subject,
    },
    {
      type: 'week4',
      name: 'Week 4 - Making My Move',
      timing: 'Sent 7 days after Email 5 (admin-configurable)',
      subject: WEEK4_EMAIL.subject,
    },
    {
      type: 'wrapup',
      name: '30-Day Wrap-Up (Different Now)',
      timing: 'Sent 7 days after Email 6 (admin-configurable)',
      subject: WRAPUP_EMAIL.subject,
    },
  ];
}
