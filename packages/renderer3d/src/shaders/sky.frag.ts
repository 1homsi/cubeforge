// Sky fragment shader — Preetham / A.J. Preetham et al. (1999) sky model.
// Implements Rayleigh + Mie scattering for a physically-plausible sky colour
// without an HDR pipeline dependency.
//
// Uniforms:
//   u_sunDirection  — normalised world-space direction toward the sun (away from scene).
//   u_turbidity     — atmospheric turbidity (1 = very clear, 10 = hazy). Default 2.
//   u_rayleigh      — Rayleigh scattering coefficient scale. Default 1.
//   u_mieCoefficient — Mie scattering coefficient. Default 0.005.
//   u_mieDirectionalG — Mie phase asymmetry (−1..1). Default 0.8.
//   u_sunIntensity  — sun disc brightness. Default 1000.
//   u_up            — world-space "up" direction (default Y).
export const SKY_FRAG = /* glsl */ `#version 300 es
precision highp float;

in vec3 v_worldDir;

uniform vec3  u_sunDirection;
uniform float u_turbidity;
uniform float u_rayleigh;
uniform float u_mieCoefficient;
uniform float u_mieDirectionalG;
uniform vec3  u_up;

out vec4 fragColor;

// ── Physical constants ────────────────────────────────────────────────────────
const float PI       = 3.141592653589793;
const vec3  LAMBDA   = vec3(680e-9, 550e-9, 450e-9); // wavelengths RGB
const vec3  LAMBDA4  = LAMBDA * LAMBDA * LAMBDA * LAMBDA;

// Rayleigh scattering constants (per wavelength, precomputed from Preetham)
const float MIE_V     = 4.0;
const float RAYLEIGH_ZENITH_SIZE = 8.4e3;  // Rayleigh scale height (m)
const float MIE_ZENITH_SIZE      = 1.25e3; // Mie scale height (m)
const float SUN_ANGULAR_DIAMETER = 0.9999566769; // cos(0.5 degrees)

// Optical depth approximation (Preetham eq. 4)
float rayleighPhase(float cosTheta) {
  return (3.0 / (16.0 * PI)) * (1.0 + cosTheta * cosTheta);
}

float hgPhase(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 / (4.0 * PI)) * ((1.0 - g2) / pow(1.0 - 2.0 * g * cosTheta + g2, 1.5));
}

// Sun intensity based on zenith angle
float sunIntensity(float zenithCosAngle) {
  float cutoffAngle = 1.6110731556870734; // pi/1.95
  return max(0.0, 1.0 - exp(-((cutoffAngle - acos(zenithCosAngle)) * u_turbidity / 1.4)));
}

void main() {
  vec3 dir = normalize(v_worldDir);

  // Sun direction (must point away from scene toward sky)
  vec3 sunDir = normalize(u_sunDirection);
  vec3 up     = normalize(u_up);

  float cosTheta    = dot(dir, sunDir);
  float cosZenith   = dot(up, dir);
  float sunCosZenith = dot(up, sunDir);

  float sunE = sunIntensity(sunCosZenith);

  // Extinction / inscatter coefficients (Preetham-Hosek approximation)
  float rayleighCoeff = u_rayleigh - (1.0 * (1.0 - clamp(cosZenith, 0.0, 1.0)));
  float mieCoeff      = u_mieCoefficient;

  // Total Rayleigh + Mie extinction
  vec3 betaR = vec3(5.804542996261093e-6, 1.3562281817209593e-5, 3.0265902741212533e-5) * rayleighCoeff;
  vec3 betaM = vec3(2.1e-5) * mieCoeff;

  // Optical depth (approximate with secant)
  float zenithSec = 1.0 / (max(cosZenith, 0.03) + 0.15 * pow(93.885 - degrees(acos(cosZenith)), -1.253));
  vec3  Fex       = exp(-(betaR * RAYLEIGH_ZENITH_SIZE + betaM * MIE_ZENITH_SIZE) * zenithSec);

  // In-scatter
  vec3 betaRTheta = betaR * rayleighPhase(cosTheta);
  vec3 betaMTheta = betaM * hgPhase(cosTheta, u_mieDirectionalG);

  float zenithSecSun = 1.0 / (max(sunCosZenith, 0.03) + 0.15 * pow(93.885 - degrees(acos(max(sunCosZenith,-1.0))), -1.253));
  vec3 Fexsun = exp(-(betaR * RAYLEIGH_ZENITH_SIZE + betaM * MIE_ZENITH_SIZE) * zenithSecSun);

  vec3 Lin = sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * (1.0 - Fex);
  Lin *= mix(
    vec3(1.0),
    pow(sunE * ((betaRTheta + betaMTheta) / (betaR + betaM)) * Fexsun, vec3(0.5)),
    clamp(pow(1.0 - sunCosZenith, 5.0), 0.0, 1.0)
  );

  // Night-time sky base (subtle blue-tint when below horizon)
  vec3 L0 = vec3(0.02) * Fex;

  // Sun disc
  float sunAngularDiameterCos = SUN_ANGULAR_DIAMETER;
  float sundisk = smoothstep(sunAngularDiameterCos, sunAngularDiameterCos + 0.00002, cosTheta);
  L0 += sunE * 19000.0 * Fex * sundisk;

  // Filmic tone mapping — works without an HDR pipeline
  vec3 color = (Lin + L0) * 1.5;
  color = vec3(1.0) - exp(-color);

  // Gamma correction
  color = pow(max(color, vec3(0.0)), vec3(1.0 / 2.2));

  fragColor = vec4(color, 1.0);
}
`
