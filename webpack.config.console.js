const { createApp, createExample } = require('./webpack.config.common.js');
const { createNodeEntryPoint, createNodeApp } = require("./webpack.config.common");

const examples = ['proteopedia-wrapper', 'basic-wrapper', 'lighting', 'alpha-orbitals'];

module.exports = [
    createNodeApp('viewer', 'molstar'),
    createNodeApp('docking-viewer', 'molstar'),
    createNodeApp('mesoscale-explorer', 'molstar'),
    ...examples.map(createExample)
];