export type Tweet = {
  handle: string;
  content: string;
  excerpt?: string;
  link: string;
};

// Only add testimonials verified to describe Modesto, with the author's original wording.
// The inherited upstream testimonials are not endorsements of this project.
export const tweets: Tweet[] = [];
