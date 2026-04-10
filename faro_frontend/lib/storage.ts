export type SavedSearch = {
  id: string;
  query: string;
  region: string;
  createdAt: string;
};

export type ChatMessage = {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
};

export type PopulationCache = Record<
  string,
  { value: string; fetchedAt: number }
>;
export type EconomyCache = Record<
  string,
  {
    value: {
      businessScore: number;
      opportunityScore: number;
      networkStrength: number;
    };
    fetchedAt: number;
  }
>;

export type Profile = {
  name: string;
  business: string;
  stage: string;
  industry: string;
  relocationWindow: string;
  budget: string;
  priorities: string[];
};

export type AuthSession = {
  token: string;
  expiresAt: string;
  user: {
    id: number;
    email: string;
    name: string | null;
  };
};

const storageKeys = {
  favorites: "faro:favorites",
  searches: "faro:searches",
  chat: "faro:chat",
  profile: "faro:profile",
  auth: "faro:auth",
  population: "faro:population",
  economy: "faro:economy",
};

const read = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(key, JSON.stringify(value));
};

export const storage = {
  getFavorites: () => read<string[]>(storageKeys.favorites, []),
  setFavorites: (value: string[]) => write(storageKeys.favorites, value),
  getSearches: () => read<SavedSearch[]>(storageKeys.searches, []),
  setSearches: (value: SavedSearch[]) => write(storageKeys.searches, value),
  getChat: () => read<ChatMessage[]>(storageKeys.chat, []),
  setChat: (value: ChatMessage[]) => write(storageKeys.chat, value),
  getProfile: () =>
    read<Profile>(storageKeys.profile, {
      name: "",
      business: "",
      stage: "Idea",
      industry: "Tech",
      relocationWindow: "3-6 months",
      budget: "$50k-$150k",
      priorities: ["Cost", "Network"],
    }),
  setProfile: (value: Profile) => write(storageKeys.profile, value),
  getAuth: () => read<AuthSession | null>(storageKeys.auth, null),
  setAuth: (value: AuthSession | null) => write(storageKeys.auth, value),
  getPopulationCache: () =>
    read<PopulationCache>(storageKeys.population, {}),
  setPopulationCache: (value: PopulationCache) =>
    write(storageKeys.population, value),
  getEconomyCache: () => read<EconomyCache>(storageKeys.economy, {}),
  setEconomyCache: (value: EconomyCache) =>
    write(storageKeys.economy, value),
};
