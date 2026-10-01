/**
 * Pure collision/geometry utilities shared by server and client.
 * No side effects, no IO, no game state mutation.
 */

export function getBarrierBounds(barrier) {
  return {
    left: barrier.x - barrier.width / 2,
    right: barrier.x + barrier.width / 2,
    top: barrier.y - barrier.height / 2,
    bottom: barrier.y + barrier.height / 2,
  };
}

function aabbOverlaps(cx, cy, halfW, halfH, b) {
  return !(
    cx + halfW <= b.left ||
    cx - halfW >= b.right ||
    cy + halfH <= b.top ||
    cy - halfH >= b.bottom
  );
}

/**
 * Move an AABB (centered at desired) out of any barrier it penetrates, using
 * minimum-penetration resolution. Falls back to the current position if a
 * barrier can't be resolved cleanly.
 */
export function resolveBarrierCollision(currentX, currentY, desiredX, desiredY, barriers, playerWidth, playerHeight) {
  const halfW = playerWidth / 2;
  const halfH = playerHeight / 2;
  let x = desiredX;
  let y = desiredY;

  for (const barrier of barriers) {
    const b = getBarrierBounds(barrier);
    if (!aabbOverlaps(x, y, halfW, halfH, b)) continue;

    const penetrationRight = (x + halfW) - b.left;   // push left by this
    const penetrationLeft = b.right - (x - halfW);   // push right by this
    const penetrationBottom = (y + halfH) - b.top;   // push up by this
    const penetrationTop = b.bottom - (y - halfH);   // push down by this

    const overlapX = penetrationRight < penetrationLeft ? -penetrationRight : penetrationLeft;
    const overlapY = penetrationBottom < penetrationTop ? -penetrationBottom : penetrationTop;

    if (Math.abs(overlapX) < Math.abs(overlapY)) {
      x += overlapX;
    } else if (Math.abs(overlapY) < Math.abs(overlapX)) {
      y += overlapY;
    } else {
      x += overlapX;
      y += overlapY;
    }

    if (aabbOverlaps(x, y, halfW, halfH, b)) {
      x = currentX;
      y = currentY;
    }
  }

  return { x, y };
}

/** Cohen-Sutherland outcode for a point relative to a rect. */
function outcode(x, y, b) {
  let code = 0;
  if (x < b.left) code |= 1;
  else if (x > b.right) code |= 2;
  if (y < b.top) code |= 4;
  else if (y > b.bottom) code |= 8;
  return code;
}

/** Do segments (x1,y1)-(x2,y2) and (x3,y3)-(x4,y4) intersect? */
function intersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denominator === 0) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** Does the segment point1→point2 (inflated by `radius`) cross any barrier? */
export function checkProjectileBarrierCollision(point1, point2, barriers, radius = 0) {
  for (const barrier of barriers) {
    const raw = getBarrierBounds(barrier);
    const b = {
      left: raw.left - radius,
      right: raw.right + radius,
      top: raw.top - radius,
      bottom: raw.bottom + radius,
    };

    const code1 = outcode(point1.x, point1.y, b);
    const code2 = outcode(point2.x, point2.y, b);

    if ((code1 & code2) !== 0) continue;             // both outside on the same side
    if (code1 === 0 && code2 === 0) return true;     // both inside

    const hit = (
      intersectsLine(point1.x, point1.y, point2.x, point2.y, b.left, b.top, b.right, b.top) ||
      intersectsLine(point1.x, point1.y, point2.x, point2.y, b.right, b.top, b.right, b.bottom) ||
      intersectsLine(point1.x, point1.y, point2.x, point2.y, b.right, b.bottom, b.left, b.bottom) ||
      intersectsLine(point1.x, point1.y, point2.x, point2.y, b.left, b.bottom, b.left, b.top)
    );
    if (hit) return true;
  }
  return false;
}

export function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
