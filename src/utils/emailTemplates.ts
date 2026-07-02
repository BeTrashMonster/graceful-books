/**
 * Email Template Utilities
 *
 * Shared email template types, defaults, and helper constants for workshop emails.
 * Used by EmailTemplateEditor, EmailPreviewPanel, and WorkshopFormPage.
 */

// =============================================================================
// TYPE DEFINITIONS
// =============================================================================

export interface EmailTemplate {
  subject: string;
  preheader?: string;
  htmlBody: string;
  plainTextBody?: string;
  fromName?: string;
}

export interface EmailTemplates {
  welcome?: EmailTemplate;
  reminder?: EmailTemplate;
  week1?: EmailTemplate;
  week2?: EmailTemplate;
  week3?: EmailTemplate;
  week4?: EmailTemplate;
  wrapUp?: EmailTemplate;
}

export type EmailType = 'welcome' | 'reminder' | 'week1' | 'week2' | 'week3' | 'week4' | 'wrapUp';

// =============================================================================
// DEFAULT EMAIL TEMPLATES
// =============================================================================

export const DEFAULT_EMAIL_TEMPLATES: Record<EmailType, EmailTemplate> = {
  welcome: {
    subject: '[AM] IN! Here\'s your first steps',
    preheader: 'Welcome — I am so glad you\'re here!',
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #4b006e;">Welcome — I am so glad you're here!</h1>

  <p>Hey {{firstName}},</p>

  <p>Good on you for signing up and leaning into the part most entrepreneurs avoid: the numbers 😬</p>

  <p>Here is what I want you to know before we begin - you are wildly capable. You don't have to become a different person to understand your business. You just need a better tool and a little guidance.</p>

  <p>So let's get you ready.</p>

  <h3 style="color: #4b006e;">Before class, there's about an hour of prework.</h3>
  <p>It isn't busywork — it is the foundation everything else sits on. Here's what it looks like:</p>

  <ol>
    <li><strong>Pick ONE product.</strong> Just one. Your bestseller, your favorite, or the one you are most curious (or most nervous) about. We're going to follow it all the way through.</li>
    <li><strong>Gather your invoices & receipts.</strong> Ingredients, packaging, labels — whatever goes into that one product. Recent ones, so we're working off today's prices, not last year's.</li>
    <li><strong>Fill out the worksheet.</strong> We'll walk you through your product's information line by line. No accounting degree required, I promise.</li>
    <li><strong>Add your invoices.</strong> Put them in so your costs reflect what you're actually paying now.</li>
  </ol>

  <p><strong>→ Have this complete by the beginning of the workshop.</strong></p>

  <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D4AF37;">
    <p style="margin: 0;"><a href="https://app.audacious.money/login" style="color: #4b006e; text-decoration: none; font-weight: 600;">Click here to log in and pick up where you left off →</a></p>
    <p style="margin: 10px 0 0 0; font-size: 14px; color: #666;">https://app.audacious.money/login</p>
  </div>

  <h3 style="color: #4b006e;">Now, about your recipes.</h3>
  <p>I know your formulations are sacred — they are the heart of everything you have built. So let me be completely clear: this software is <em>zero-knowledge</em>. Your recipes, your invoices, your numbers are encrypted in a way that only you can see them.</p>

  <p>Sovereignty over your data and your business is crucial to our next evolution.</p>

  <p>One more thing — and this one's just for fun:</p>
  <p>Before we get into the software, what do you <em>think</em> it costs you to make one unit of that product right now? Go with what you currently know to be true. <strong>Hit reply and send me your number.</strong></p>

  <p>That's it. One product. A few invoices. Your current number. You've got this.</p>

  <p>See you {{workshopDate}},<br>Audrey<br><em>Audacious Money</em></p>

  <p style="font-size: 14px;"><strong>P.S.</strong> If anything feels stuck or unclear, just reply to this email. A real human (me) is on the other end.</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
  },
  reminder: {
    subject: '[AM] Ready for tomorrow?',
    preheader: 'It\'s almost time! ✨',
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #4b006e;">It's almost time! ✨</h1>

  <p>Hey {{firstName}},</p>

  <p>Soon we're getting together to connect you deeper with your business — and I cannot wait.</p>

  <h3 style="color: #4b006e;">A tiny checklist so you walk in ready:</h3>

  <ul style="list-style: none; padding-left: 0;">
    <li>✅ <strong>Your worksheet is complete</strong> — one product, invoices added. If it's not quite finished, that's okay. Do what you can. → <a href="https://app.audacious.money/login" style="color: #4b006e;">Finish your worksheet</a></li>
    <li>✅ <strong>Your laptop is charged and connects to WiFi.</strong> This is hands-on — you'll have your product clarity on screen <em>and</em> in hand.</li>
    <li>✅ <strong>You've brought yourself, exactly as you are.</strong></li>
  </ul>

  <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #D4AF37;">
    <p style="margin: 0; font-size: 16px;">
      📅 {{workshopDate}}<br>
      📍 {{workshopLocation}}
    </p>
  </div>

  <p>Can't wait to get a little curious (and maybe a little uncomfortable — that's where the good stuff lives).</p>

  <p>Remember: your numbers are the language your business has been speaking to you this whole time. Tomorrow, we start listening together.</p>

  <p>There is liberation in knowledge that can't be expressed until it's felt. Come ready to feel it.</p>

  <p>See you in the morning,<br>Audrey</p>

  <p style="font-size: 14px;"><strong>P.S.</strong> Didn't get to that initial cost number question yet? Hit reply and send it now.</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
  },
  week1: {
    subject: '[AM] Following the Trail',
    preheader: 'Now the real magic begins',
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <p>HEYO!</p>

  <p>Am I just nerdy or was that a great workshop - thank you for joining us! 🌸</p>

  <p>Now the real magic begins: 30 days of small, intentional steps. Not a big, overwhelming overhaul. Just one focused move each week. (This is exactly how lasting change actually forms — tiny and consistent beats heroic and unsustainable, every time.)</p>

  <p><strong>This week: follow ONE product, start to finish.</strong></p>

  <p>Take the product we worked with — and this time, watch it move through its cycle to bring it to life. From raw materials all the way to your customer's hands. As you go, just notice:</p>

  <ul>
    <li>How much <strong>time</strong> it actually takes you (mixing, packaging, labeling — all of it)</li>
    <li>Every <strong>touchpoint</strong> it passes through on its way to a customer</li>
  </ul>

  <p>You're not changing anything yet. You're just paying attention. Awareness first. Always.</p>

  <p>Here's your question for the week:</p>

  <p><strong>How many separate touchpoints did your product pass through before it reached your customer? Reply with just the number</strong></p>

  <p>I read every reply - the language of numbers is beautiful in all it's forms.</p>

  <p>Talk soon,<br>Audrey</p>

  <p><strong>P.S.</strong> Presence, not performance. There is no wrong number here — there's just what is true.</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
  },
  week2: {
    subject: '[AM] Seeing the Whole Picture',
    preheader: 'Time to put a number on it',
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Hey {{firstName}},</p>

  <p>Last week you tracked your product through each touchpoint. This week, we put a number on it.</p>

  <p><strong>This week: update the complete cost per unit in the software</strong></p>

  <p>Not just materials. The whole truth:</p>

  <blockquote style="border-left: 4px solid #D4AF37; padding-left: 16px; margin: 20px 0; color: #4b006e;">
    <strong>Materials + Labor (your time has value) + Distribution (the journey to your customer)</strong>
  </blockquote>

  <p>Most entrepreneurs are stunned by one part in particular — and for so many, it's their own labor. Your time is one of your largest costs, even (<em>especially</em>) when you're the one doing the work. So count it. If your business grew, you'd have to pay someone to do this, right? That's the number.</p>

  <p>This is the moment your business stops being a mystery and starts being yours.</p>

  <p>And here's your question:</p>

  <p><strong>Remember your number from Day 1? What are you seeing now that you've done the math? Hit reply and tell me.</strong></p>

  <p>I genuinely want to know — and there's no judgment in either direction. It is just information. Beautiful, useful information.</p>

  <p>Cheering you on,<br>Audrey</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
  },
  week3: {
    subject: '[AM] Now We\'re Talking',
    preheader: 'You know your number now',
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Hey {{firstName}},</p>

  <p>You know your number now and going at this with your eyes wide open.</p>

  <p>That's game changer energy, my friend.</p>

  <p>This week, we put it next to your price.</p>

  <p><strong>This week: compare your complete cost to what you're currently charging.</strong></p>

  <p>That's it. Line them up and look. What you see is your business telling you something specific — not a judgment, not a grade. Just a signal. And now you speak the language, so you can actually hear it.</p>

  <p>Some of what you find will feel like momentum. Some of it might point to your next move. Either way, you earned this clarity — and clarity is where confident decisions are made.</p>

  <p>Here's your question:</p>

  <p><strong>What is your cost per unit telling you right now? Hit reply with one word.</strong></p>

  <p>One word. I'll know exactly what you mean.</p>

  <p>Still cheering,<br>Audrey</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
  },
  week4: {
    subject: '[AM] Making My Move',
    preheader: 'Time to make ONE informed decision',
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Hi {{firstName}},</p>

  <p>You've watched. You've calculated. You've listened. Now we move.</p>

  <p><strong>This week: make ONE informed decision.</strong></p>

  <p>Just one. You don't have to overhaul everything — that's how people burn out and abandon the whole thing. One decision, made on purpose, is how real change actually sticks.</p>

  <p>It could be:</p>

  <ul>
    <li>Adjusting a price</li>
    <li>Focusing on the channel that actually serves you</li>
    <li>Streamlining one part of your process</li>
    <li>Saying a respectful <em>"no"</em> to an opportunity that doesn't fit</li>
  </ul>

  <p>Saying yes to what serves your goals — and no to what doesn't — isn't being difficult. It's being intentional. That's the whole point.</p>

  <p>Your question this week is really a commitment:</p>

  <p><strong>What is the ONE decision you're making this week — and <em>when exactly</em> will you make it? Reply and put it in writing.</strong></p>

  <p>Saying it out loud (or typing it to me) makes it real. So hit reply, tell me your decision and your day, and I'll be in your corner when it happens.</p>

  <p>Proud of you,<br>Audrey</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
  },
  wrapUp: {
    subject: '[AM] Different Now',
    preheader: 'Thirty days ago you showed up',
    htmlBody: `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Hey {{firstName}},</p>

  <p>Thirty days ago you showed up - for your numbers, for your business, for yourself.</p>

  <p>And you did the work.</p>

  <p>You followed one product all the way through. You learned what it actually costs to make it.</p>

  <p>You lined up your price and looked it in the eye. And then you made a decision - on purpose, with clarity - because now you speak the language.</p>

  <p>So here's my favorite question of this entire journey:</p>

  <p><strong>What feels different now? Hit reply and let me know</strong> 🌸</p>

  <p>I read every single one.</p>

  <p>And one more thing on a more personal note - because you've spent 30 days inside this software, your experience matters more to me than almost anyone else's right now:</p>

  <p><strong>What would make this tool work even harder for you and your business?</strong></p>

  <p>I'm actively building and I want to build it for <em>you</em>. No suggestion is too small or too bold. Hit reply and tell me that too.</p>

  <p>Thank you for trusting this process - and for trusting me with your numbers. It's not lost on me what that takes.</p>

  <p>Money matters, but the heart counts.. here's to knowing your worth, my friend.</p>

  <p>Audrey<br><em>Audacious Money</em></p>

  <p><strong>P.S.</strong> This was never about becoming perfect with your numbers. It was about becoming <em>connected</em> to them. And you did exactly that. 🌸</p>

  <hr style="border: none; border-top: 2px solid #D4AF37; margin: 30px 0;">
  <p style="font-size: 12px; color: #9ca3af;">
    Audacious Money<br>
    Building financial confidence, one step at a time.
  </p>
</div>`,
  },
};

// =============================================================================
// EMAIL TYPE LABELS (for UI display)
// =============================================================================

export const EMAIL_TYPE_LABELS: Record<EmailType, string> = {
  welcome: 'Welcome Email',
  reminder: 'Pre-Workshop Reminder',
  week1: 'Week 1 Email',
  week2: 'Week 2 Email',
  week3: 'Week 3 Email',
  week4: 'Week 4 Email',
  wrapUp: 'Wrap-Up Email',
};

// =============================================================================
// TEMPLATE TAGS (for autocomplete/reference)
// =============================================================================

export interface TemplateTag {
  tag: string;
  description: string;
}

export const TEMPLATE_TAGS: TemplateTag[] = [
  { tag: '{{firstName}}', description: "Recipient's first name" },
  { tag: '{{fullName}}', description: "Recipient's full name" },
  { tag: '{{workshopName}}', description: 'Workshop cohort name' },
  { tag: '{{workshopDate}}', description: 'Workshop start date' },
  { tag: '{{workshopTime}}', description: 'Workshop start time' },
  { tag: '{{workshopLocation}}', description: 'Workshop location/URL' },
  { tag: '{{trialEndDate}}', description: 'Trial expiration date' },
  { tag: '{{trialDaysRemaining}}', description: 'Days until trial expires' },
];

// =============================================================================
// ALL EMAIL TYPES (for iteration)
// =============================================================================

export const ALL_EMAIL_TYPES: EmailType[] = [
  'welcome',
  'reminder',
  'week1',
  'week2',
  'week3',
  'week4',
  'wrapUp',
];
