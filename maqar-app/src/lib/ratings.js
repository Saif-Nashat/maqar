// Blend a room's seeded rating with any user-added reviews.
export function combinedRating(room, extraReviews) {
  const extra = extraReviews || [];
  const count = room.reviews + extra.length;
  if (!count) return { avg: room.rating ?? 0, count: 0 };
  const sum = (room.rating || 0) * room.reviews + extra.reduce((a, r) => a + r.rating, 0);
  return { avg: Math.round((sum / count) * 10) / 10, count };
}
