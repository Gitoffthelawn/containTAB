import GlobalConfig from '../GlobalConfig';

export async function isFingerprintEnabled() {
  const config = await GlobalConfig.get();
  return config.experimental?.fingerprint?.enabled === true;
}
