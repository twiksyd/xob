// Roblox Discount Active tag — animated rainbow rectangle badge. Styles live
// in globals.css (.discount-badge) as one shared keyframe rather than a
// per-instance <style> block, since this can render 50+ times on the
// Accounts page at once.
export default function DiscountBadge() {
  return <span className="discount-badge">DISCOUNT ACTIVE</span>
}
