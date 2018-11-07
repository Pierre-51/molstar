/**
 * Copyright (c) 2018 mol* contributors, licensed under MIT, See LICENSE file for more info.
 *
 * @author David Sehnal <david.sehnal@gmail.com>
 */

import { PluginBehavior } from './behavior';
import { PluginCommands } from 'mol-plugin/command';

export const SetCurrentObject = PluginBehavior.create({
    name: 'set-current-data-object-behavior',
    ctor: PluginBehavior.simpleCommandHandler(PluginCommands.Data.SetCurrentObject, ({ ref }, ctx) => ctx.state.data.setCurrent(ref)),
    display: { name: 'Set Current Handler' }
});

export const Update = PluginBehavior.create({
    name: 'update-data-behavior',
    ctor: PluginBehavior.simpleCommandHandler(PluginCommands.Data.Update, ({ tree }, ctx) => ctx.runTask(ctx.state.data.update(tree))),
    display: { name: 'Update Data Handler' }
});