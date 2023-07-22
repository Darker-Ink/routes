const term = require('terminal-kit').terminal;
const { FirstRoutes: routes } = require('../saves/Routes.js');
const fs = require('fs');
const path = require('path');
const { request } = require('undici');
const config = require('./ConfigManager.js').getConfig();

const ErrorHooks = config.Webhooks.filter((hook) => hook.send.errors);
let errorsSent = 0;

process.on('unhandledRejection', async (reason, promise) => {

  if (errorsSent >= 10) {
    process.exit(1);
  }

  // fuck rate limits (I honestly doubt we'll send enough)
  for (const hook of ErrorHooks) {
    await request(hook.url, {
      body: JSON.stringify({
        embeds: [{
          title: 'Unhandled Rejection',
          description: `\`\`\`\n${reason.stack}\n\`\`\``,
          color: 0xFF0000, // red
          timestamp: new Date().toISOString(),
        }],
        content: config.ErrorMsg
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  console.error(reason);

  errorsSent++;
});

process.on('uncaughtException', async (error) => {

  if (errorsSent >= 10) {
    process.exit(0);
  }

  for (const hook of ErrorHooks) {
    await request(hook.url, {
      body: JSON.stringify({
        embeds: [{
          title: 'Uncaught Exception',
          description: `\`\`\`\n${error.stack}\n\`\`\``,
          color: 0xFF0000, // red
          timestamp: new Date().toISOString(),
        }],
        content: config.ErrorMsg
      }),
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  }

  console.error(error);

  errorsSent++;
});


if (!fs.existsSync(path.join(__dirname, '../saves/Json/Endpoints'))) {
  fs.mkdirSync(path.join(__dirname, '../saves/Json/Endpoints'));
}

if (!fs.existsSync(path.join(__dirname, '../saves/Json/Endpoints/Routes.json'))) {
  fs.writeFileSync(path.join(__dirname, '../saves/Json/Endpoints/Routes.json'), JSON.stringify({}));
}

const knownRoutes = require('../saves/Json/Endpoints/Routes.json'); // routes we know about already
const WebhookUtils = require('./WebhookUtils.js');

const routeroutes = { ...knownRoutes };
const newRoutes = [];
const changedRoutes = [];
const allRoutes = [];

// mappings for the different times of paths
const map = {
  guild: ':guildId',
  channel: ':channelId',
  user: ':userId',
  role: ':roleId',
  message: ':messageId',
  subscription: ':subscriptionId',
  relationship: ':relationshipId',
  reaction: ':reactionId',
  application: ':applicationId',
  integration: ':applicationId',
  invite: ':inviteCode',
  member: ':memberId',
};

function extractArgs(fn) {
  const argValues = [];
  for (let i = 0; i < fn.length; i++) {
    argValues.push(`ARG${i}`);
  }
  return { argValues };
}

function newRoute(value, route) {
  const newRoute = route.split('/');
  const newArgs = [];

  for (let i = 0; i < newRoute.length; i++) {
    const val = newRoute[i];
    const nextval = newRoute[i + 1] || '';
    const nextvalsplit = nextval.split('.');

    if (nextvalsplit.length > 1) {
      const nextvalsplit1 = nextvalsplit[0];
      const nextvalsplit2 = nextvalsplit[1];

      if (nextvalsplit1.includes('ARG') && nextvalsplit2.includes('ARG')) {
        // assuming the its a hash for the image
        newArgs.push(':hash');
        // png, jpg, gif, webp (etc)
        newArgs.push(':type');

        continue;
      }
    }

    if (nextval.includes('ARG')) {
      // replace the like S at the end else its just :unknown
      // soon will improve this
      newArgs.push(map[val.replace(/s$/, '')] || ':unknown');

      continue;
    }
  }

  const uppped = value(...newArgs);

  return {
    route: uppped,
    args: newArgs,
  };
}

Object.entries(routes).forEach(([key, value]) => {
  if (typeof value === 'function') {
    const { argValues } = extractArgs(value);

    const { route, args: routeArgs } = newRoute(value, value(...argValues));

    const routeKey = routeroutes[key];
    if (!routeKey) {
      const setup = {
        route: route,
        args: routeArgs,
        firstSeen: Date.now(),
        oldRoutes: [],
        key: key,
      };
      routeroutes[key] = setup;
      newRoutes.push(setup);
      allRoutes.push(setup);
      term.blue(`\nNew Endpoint Found: ${key}, ${route}`);
    } else if (routeKey.route !== route) {
      term.yellow(`\nEndpoint Changed: ${key}, ${routeKey.route} -> ${route}`);
      routeKey.oldRoutes.push({
        route: routeKey.route,
        args: routeKey.args,
        changedAt: Date.now(),
      });
      routeKey.route = route;
      changedRoutes.push(routeKey);
      allRoutes.push(routeKey);
    } else {
      allRoutes.push(routeKey);
    }
  } else {
    const route = routeroutes[key];
    if (!route) {
      const setup = {
        route: value,
        args: [],
        firstSeen: Date.now(),
        oldRoutes: [],
        key: key,
      };
      routeroutes[key] = setup;
      newRoutes.push(setup);
      allRoutes.push(setup);
      term.blue(`\nNew Endpoint Found: ${key}, ${value}`);
    } else if (route.route !== value) {
      term.yellow(`\nEndpoint Changed: ${key}, ${route.route} -> ${value}`);
      route.oldRoutes.push({
        route: route.route,
        args: route.args,
        changedAt: Date.now(),
      });
      route.route = value;
      changedRoutes.push(route);
      allRoutes.push(route);
    } else {
      allRoutes.push(route);
    }
  }
});

const deletedRoutes = [];

// goes through all routes and known routes and see if any where deleted
Object.entries(routeroutes).forEach(([key, value]) => {
  const route = routes[key];
  if (!route) {
    deletedRoutes.push(value);
    delete routeroutes[key];
    term.red(`\nEndpoint Deleted: ${key}, ${value.route}`);
  }
});

term.green(`\nWe found ${newRoutes.length} new endpoints and there were ${changedRoutes.length} changed endpoints and ${deletedRoutes.length} endpoints were deleted.\n`);

WebhookUtils.stats(`We found **${newRoutes.length}** new endpoints and there were **${changedRoutes.length}** changed endpoints and **${deletedRoutes.length}** endpoints were deleted.`, 'Endpoint Check');

fs.writeFileSync(path.join(__dirname, '../saves/Json/Endpoints/Endpoints.json'), JSON.stringify(routeroutes, null, 4));
fs.writeFileSync(path.join(__dirname, '../saves/Json/Endpoints/New.json'), JSON.stringify(newRoutes.length ? newRoutes : [], null, 4));
fs.writeFileSync(path.join(__dirname, '../saves/Json/Endpoints/Changed.json'), JSON.stringify(changedRoutes.length ? changedRoutes : [], null, 4));
fs.writeFileSync(path.join(__dirname, '../saves/Json/Endpoints/Deleted.json'), JSON.stringify(deletedRoutes.length ? deletedRoutes : [], null, 4));