import { byId, safeText } from "../core/dom.js";

function createPersonItem(person){
  const item = document.createElement("li");
  item.className = "people-person";

  if (person.image){
    const image = document.createElement("img");
    image.className = "people-image";
    image.src = person.image;
    image.alt = person.name;
    image.loading = "lazy";
    image.decoding = "async";
    image.width = 160;
    item.appendChild(image);
  }

  const name = document.createElement("div");
  name.className = "card-value people-name";
  name.textContent = person.name;
  item.appendChild(name);

  if (person.relation){
    const relation = document.createElement("div");
    relation.className = "card-sub people-relation";
    relation.textContent = person.relation;
    item.appendChild(relation);
  }

  return item;
}

function createPeopleGroup(group){
  const card = document.createElement("article");
  card.className = "card people-group";

  const label = document.createElement("h4");
  label.className = "card-label people-group-label";
  label.textContent = group.label;
  card.appendChild(label);

  const list = document.createElement("ul");
  list.className = "people-list";
  list.setAttribute("role", "list");

  group.people.forEach((person) => {
    list.appendChild(createPersonItem(person));
  });

  card.appendChild(list);
  return card;
}

export function renderPeople(people){
  const section = byId("personas");
  const title = byId("peopleTitle");
  const intro = byId("peopleIntro");
  const groups = byId("peopleGroups");

  if (!section || !title || !intro || !groups) return false;

  const validGroups = Array.isArray(people?.groups)
    ? people.groups.filter((group) =>
      group &&
      typeof group.label === "string" &&
      group.label.trim() &&
      Array.isArray(group.people) &&
      group.people.length > 0
    )
    : [];

  if (!people?.enabled || validGroups.length === 0){
    section.hidden = true;
    groups.replaceChildren();
    return false;
  }

  safeText(title, people.title);
  safeText(intro, people.intro);
  groups.replaceChildren(...validGroups.map(createPeopleGroup));
  section.hidden = false;
  return true;
}
