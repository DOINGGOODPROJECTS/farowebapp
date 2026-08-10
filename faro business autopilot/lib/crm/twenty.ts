import "server-only";

interface TwentyPerson {
  id: string;
}

function twentyHeaders() {
  return {
    Authorization: `Bearer ${process.env.CRM_API_KEY}`,
    "Content-Type": "application/json",
  };
}

async function twentyFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${process.env.CRM_API_URL}${path}`, {
    ...init,
    headers: { ...twentyHeaders(), ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Twenty CRM ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

export async function findPersonByEmail(email: string): Promise<TwentyPerson | null> {
  const query = new URLSearchParams({ filter: `emails.primaryEmail[eq]:${email}` });
  const body = await twentyFetch(`/rest/people?${query.toString()}`);
  return body.data.people[0] ?? null;
}

export async function createPerson(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
}): Promise<TwentyPerson> {
  const body = await twentyFetch("/rest/people", {
    method: "POST",
    body: JSON.stringify({
      name: { firstName: input.firstName, lastName: input.lastName },
      ...(input.email ? { emails: { primaryEmail: input.email } } : {}),
      ...(input.phone ? { phones: { primaryPhoneNumber: input.phone } } : {}),
      ...(input.jobTitle ? { jobTitle: input.jobTitle } : {}),
    }),
  });
  return body.data.createPerson;
}

export async function addNoteToPerson(personId: string, title: string, markdown: string) {
  const note = await twentyFetch("/rest/notes", {
    method: "POST",
    body: JSON.stringify({ title, bodyV2: { markdown } }),
  });
  const noteId = note.data.createNote.id;

  await twentyFetch("/rest/noteTargets", {
    method: "POST",
    body: JSON.stringify({ noteId, targetPersonId: personId }),
  });
}

export async function findOrCreatePerson(input: {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  jobTitle?: string;
}): Promise<TwentyPerson> {
  if (input.email) {
    const existing = await findPersonByEmail(input.email);
    if (existing) return existing;
  }
  return createPerson(input);
}
