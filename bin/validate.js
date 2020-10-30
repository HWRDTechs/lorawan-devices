#!/usr/bin/env node

const Ajv = require('ajv');
const yargs = require('yargs');
const fs = require('fs');
const yaml = require('js-yaml');

let validate = new Ajv().addSchema([require('../lib/draft/schema.json'), require('../schema.json')]);

const options = yargs.usage('Usage: --vendor <file>').option('v', {
  alias: 'vendor',
  describe: 'Path to vendor index file',
  type: 'string',
  demandOption: true,
  default: './vendor/index.yaml',
}).argv;

let validateVendors = validate.compile({
  $ref: 'https://schema.thethings.network/devicerepository/1/schema#/definitions/vendors',
});
let validateVendor = validate.compile({
  $ref: 'https://schema.thethings.network/devicerepository/1/schema#/definitions/vendor',
});
let validateEndDevice = validate.compile({
  $ref: 'https://lorawan-schema.org/draft/devices/1/schema#/definitions/endDevice',
});
let validateEndDeviceProfile = validate.compile({
  $ref: 'https://lorawan-schema.org/draft/devices/1/schema#/definitions/endDeviceProfile',
});

const vendors = yaml.safeLoad(fs.readFileSync(options.vendor));

if (!validateVendors(vendors)) {
  console.error(`${options.vendor} is invalid`);
  console.error(validateVendors.errors);
  process.exit(1);
}
console.log(`vendor: valid`);

vendors.vendors.forEach((v) => {
  const vendorIndexPath = `./vendor/${v.id}/index.yaml`;
  fs.stat(vendorIndexPath, (err) => {
    if (err) {
      if (err.code !== 'ENOENT') {
        console.error(`${v.id}: index file: ${err.code}`);
        process.exit(1);
      }
      return;
    }

    const vendor = yaml.safeLoad(fs.readFileSync(vendorIndexPath));
    if (!validateVendor(vendor)) {
      console.error(`${v.id}: invalid index`);
      console.error(validateVendors.errors);
      return;
    }
    console.log(`${v.id}: valid index`);

    let profiles = {};

    vendor.endDevices.forEach((d) => {
      const endDevice = yaml.safeLoad(fs.readFileSync(`./vendor/${v.id}/${d}.yaml`));
      if (!validateEndDevice(endDevice)) {
        console.error(`${v.id}: ${d}: invalid`);
        console.error(validateVendors.errors);
        process.exit(1);
      }
      console.log(`${v.id}: ${d}: valid`);

      endDevice.firmwareVersions.forEach((version) => {
        Object.keys(version.profiles).forEach((region) => {
          const id = version.profiles[region].id;
          if (!profiles[id]) {
            const profile = yaml.safeLoad(fs.readFileSync(`./vendor/${v.id}/${id}.yaml`));
            if (!validateEndDeviceProfile(profile)) {
              console.error(`${v.id}: ${d}: profile ${id} invalid`);
              console.error(validateVendors.errors);
              process.exit(1);
            }
            profiles[id] = true;
          }
          console.log(`${v.id}: ${d}: profile ${id} (${region}) valid`);
        });
      });
    });
  });
});
