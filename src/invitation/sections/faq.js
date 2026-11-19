import { byId, safeText } from "../core/dom.js";

export function renderFaq(faq){
  const section = byId("faq");
  const title = byId("faqTitle");
  const intro = byId("faqIntro");
  const list = byId("faqList");

  if (!section || !list || !faq?.enabled || faq.items.length === 0){
    return false;
  }

  safeText(title, faq.title);
  safeText(intro, faq.intro);
  if (intro) intro.hidden = !faq.intro;

  const fragment = document.createDocumentFragment();
  faq.items.forEach((item, index) => {
    const details = document.createElement("details");
    const summary = document.createElement("summary");
    const answer = document.createElement("p");

    details.className = "faq-item";
    answer.className = "faq-answer";
    summary.textContent = item.question;
    answer.textContent = item.answer;
    if (index === 0) details.open = true;
    details.append(summary, answer);
    fragment.append(details);
  });

  list.replaceChildren(fragment);
  return true;
}
