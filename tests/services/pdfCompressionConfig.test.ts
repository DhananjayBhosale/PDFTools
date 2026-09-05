import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateTargetSize,
  getAdaptiveConfig,
  getInterpolatedConfig,
} from '../../services/pdfCompressionConfig.ts';

test('compression presets stay within their intended quality order', () => {
  const extreme = getAdaptiveConfig('extreme', false);
  const recommended = getAdaptiveConfig('recommended', false);
  const less = getAdaptiveConfig('less', false);

  assert.ok(extreme.projectedDPI < recommended.projectedDPI);
  assert.ok(recommended.projectedDPI < less.projectedDPI);
  assert.ok(extreme.quality < recommended.quality);
  assert.ok(recommended.quality < less.quality);
});

test('text-heavy settings retain a safer quality floor', () => {
  const imageRich = getAdaptiveConfig('extreme', false);
  const textHeavy = getAdaptiveConfig('extreme', true);

  assert.equal(textHeavy.projectedDPI, 96);
  assert.ok(textHeavy.projectedDPI > imageRich.projectedDPI);
  assert.ok(textHeavy.quality > imageRich.quality);
});

test('slider and estimates remain bounded and deterministic', () => {
  assert.deepEqual(getInterpolatedConfig(0, false), {
    scale: 0.5,
    quality: 0.5,
    projectedDPI: 72,
  });
  assert.equal(getInterpolatedConfig(100, true).projectedDPI, 300);
  assert.equal(calculateTargetSize(1_000, 'recommended', false), 600);
  assert.equal(calculateTargetSize(1_000, 'recommended', true), 720);
});
