/**
 * Pure collision/geometry utilities.
 * No side effects, no IO, no game state mutation.
 */

function getBarrierBounds(barrier) {
  return {
    left: barrier.x - barrier.width / 2,
    right: barrier.x + barrier.width / 2,
    top: barrier.y - barrier.height / 2,
    bottom: barrier.y + barrier.height / 2,
  };
}

function resolveBarrierCollision(currentX, currentY, desiredX, desiredY, barriers, playerWidth, playerHeight) {
  let adjustedX = desiredX;
  let adjustedY = desiredY;

  for (const barrier of barriers) {
    const b = getBarrierBounds(barrier);

    const playerLeft = adjustedX - playerWidth / 2;
    const playerRight = adjustedX + playerWidth / 2;
    const playerTop = adjustedY - playerHeight / 2;
    const playerBottom = adjustedY + playerHeight / 2;

    const colliding = !(
      playerRight <= b.left ||
      playerLeft >= b.right ||
      playerBottom <= b.top ||
      playerTop >= b.bottom
    );

    if (!colliding) continue;

    let overlapX = 0;
    const penetrationRight = playerRight - b.left;
    const penetrationLeft = b.right - playerLeft;
    if (penetrationRight > 0 && penetrationLeft > 0) {
      overlapX = (penetrationRight < penetrationLeft) ? -penetrationRight : penetrationLeft;
    }

    let overlapY = 0;
    const penetrationBottom = playerBottom - b.top;
    const penetrationTop = b.bottom - playerTop;
    if (penetrationBottom > 0 && penetrationTop > 0) {
      overlapY = (penetrationBottom < penetrationTop) ? -penetrationBottom : penetrationTop;
    }

    if (overlapX === 0 && overlapY === 0) {
      adjustedX = currentX;
      adjustedY = currentY;
      continue;
    }

    if (Math.abs(overlapX) < Math.abs(overlapY)) {
      adjustedX += overlapX;
    } else if (Math.abs(overlapY) < Math.abs(overlapX)) {
      adjustedY += overlapY;
    } else {
      adjustedX += overlapX;
      adjustedY += overlapY;
    }

    // Re-check after adjustment
    const finalLeft = adjustedX - playerWidth / 2;
    const finalRight = adjustedX + playerWidth / 2;
    const finalTop = adjustedY - playerHeight / 2;
    const finalBottom = adjustedY + playerHeight / 2;

    const stillColliding = !(
      finalRight <= b.left ||
      finalLeft >= b.right ||
      finalBottom <= b.top ||
      finalTop >= b.bottom
    );

    if (stillColliding) {
      adjustedX = currentX;
      adjustedY = currentY;
    }
  }

  return { x: adjustedX, y: adjustedY };
}

/**
 * Cohen-Sutherland outcode for a point relative to a barrier's bounds.
 */
function outcode(x, y, b) {
  let code = 0;
  if (x < b.left) code |= 1;
  else if (x > b.right) code |= 2;
  if (y < b.top) code |= 4;
  else if (y > b.bottom) code |= 8;
  return code;
}

/**
 * Check if two line segments (p1-p2) and (p3-p4) intersect.
 */
function intersectsLine(x1, y1, x2, y2, x3, y3, x4, y4) {
  const denominator = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (denominator === 0) return false;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denominator;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denominator;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

function checkProjectileBarrierCollision(point1, point2, barriers) {
  for (const barrier of barriers) {
    const b = getBarrierBounds(barrier);

    const code1 = outcode(point1.x, point1.y, b);
    const code2 = outcode(point2.x, point2.y, b);

    if ((code1 & code2) !== 0) continue; // both outside same side
    if (code1 === 0 && code2 === 0) return true; // both inside

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

function distance(obj1, obj2) {
  return Math.sqrt(Math.pow(obj1.x - obj2.x, 2) + Math.pow(obj1.y - obj2.y, 2));
}

module.exports = {
  getBarrierBounds,
  resolveBarrierCollision,
  checkProjectileBarrierCollision,
  distance,
};
