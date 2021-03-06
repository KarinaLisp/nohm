const util = require('util');
const args = require(__dirname + '/testArgs.js');
const h = require('./helper.js');
const _ = require('lodash');

exports.checkModules = (t) => {
  var redis, nohm;
  t.expect(2);

  redis = require('redis');
  t.ok(
    typeof redis.createClient === 'function',
    'the redis client library should be available.',
  );

  nohm = require(__dirname + '/../tsOut');
  t.ok(
    typeof nohm === 'object',
    'nohm should be available -- something is fishy here.',
  );

  t.done();
};

const prefix = args.prefix;

// real tests start in 3.. 2.. 1.. NOW!
const redis = args.redis;
const Nohm = require(__dirname + '/../tsOut');
const async = require('async');

const nohm = Nohm.Nohm;

var UserMockup = nohm.model('UserMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
      unique: true,
      validations: ['notEmpty'],
    },
    visits: {
      type: 'integer',
      index: true,
    },
    email: {
      type: 'string',
      unique: true,
      defaultValue: 'email@email.de',
      validations: ['email'],
    },
    emailOptional: {
      type: 'string',
      unique: true,
      defaultValue: '',
      validations: [
        {
          name: 'email',
          options: {
            optional: true,
          },
        },
      ],
    },
    country: {
      type: 'string',
      defaultValue: 'Tibet',
      index: true,
      validations: ['notEmpty'],
    },
    json: {
      type: 'json',
      defaultValue: '{}',
    },
  },
  idGenerator: 'increment',
});

nohm.model('NonIncrement', {
  properties: {
    name: 'No name',
  },
});

nohm.model('UniqueInteger', {
  properties: {
    unique: {
      type: 'integer',
      unique: true,
    },
  },
});

exports.prepare = {
  redisClean: function(t) {
    t.expect(1);
    redis.keys(prefix + ':*:*Mockup:*', function(err, value) {
      const check =
        (Array.isArray(value) && value.length === 0) || value === null;
      t.ok(
        check,
        'The redis database seems to contain fragments from previous nohm testruns. Use the redis command "KEYS ' +
          prefix +
          ':*:*Mockup:*" to see what keys could be the cause.',
      );
      t.done();
    });
  },

  idIntersection: function(t) {
    var arr1 = [1, 2, 3, 4, 5, 6, 7, 8, 9],
      arr2 = [2, 3, 4, 10],
      arr3 = [2, 3, 4, 10],
      arr4 = [],
      arr5 = [16, 28, 39],
      arr6 = ['hurgelwurz', 28, 39],
      arr7 = ['hurgelwurz', 28, 39],
      arr8 = [10, 3, 2],
      testIntersection = function(arrs, resultTest) {
        var result;

        result = _.intersection.apply(_, arrs);
        t.same(result, resultTest, 'idIntersection did not perform correctly.');
      };
    t.expect(9);

    testIntersection([arr1], arr1);

    testIntersection([arr1, arr2], [2, 3, 4]);

    testIntersection([arr1, arr2, arr3], [2, 3, 4]);

    testIntersection([arr2, arr3], [2, 3, 4, 10]);

    testIntersection([arr1, arr2, arr3, arr4], []);

    testIntersection([arr1, arr2, arr3, arr5], []);

    testIntersection([arr5, arr6], [28, 39]);

    testIntersection([arr6, arr7], ['hurgelwurz', 28, 39]);

    testIntersection([arr3, arr8], [2, 3, 10]);

    t.done();
  },

  setRedisClient: function(t) {
    t.expect(2);
    nohm.client = null;
    t.throws(
      () => {
        new UserMockup();
      },
      /No redis client/,
      'Creating a model without having a redis client set did not throw an error.',
    );

    nohm.setClient(redis);

    t.doesNotThrow(() => {
      new UserMockup();
    }, 'Creating a model with a redis client set threw an error.');
    t.done();
  },

  setPrefix: function(t) {
    const oldPrefix = nohm.prefix;
    t.expect(1);
    const expectPrefix = {
      channel: 'hurgel:channel:',
      hash: 'hurgel:hash:',
      idsets: 'hurgel:idsets:',
      incrementalIds: 'hurgel:ids:',
      index: 'hurgel:index:',
      meta: {
        idGenerator: 'hurgel:meta:idGenerator:',
        properties: 'hurgel:meta:properties:',
        version: 'hurgel:meta:version:',
      },
      relationKeys: 'hurgel:relationKeys:',
      relations: 'hurgel:relations:',
      scoredindex: 'hurgel:scoredindex:',
      unique: 'hurgel:uniques:',
    };

    nohm.setPrefix('hurgel');
    t.same(
      nohm.prefix,
      expectPrefix,
      'Setting a custom prefix did not work as expected',
    );

    nohm.prefix = oldPrefix;
    t.done();
  },
};

exports.propertyTests = {
  propertyGetter: function(t) {
    const user = new UserMockup();
    t.expect(7);

    t.equals(
      typeof user.p,
      'function',
      'Property getter short p is not available.',
    );

    t.equals(
      typeof user.prop,
      'function',
      'Property getter short prop is not available.',
    );

    t.equals(
      typeof user.property,
      'function',
      'Property getter is not available.',
    );

    t.equals(
      user.property('email'),
      'email@email.de',
      'Property getter did not return the correct value for email.',
    );

    t.equals(
      user.property('name'),
      'test',
      'Property getter did not return the correct value for name.',
    );

    t.throws(
      () => {
        user.property('hurgelwurz');
      },
      /Invalid property key 'hurgelwurz'\./,
      'Calling .property() with an undefined key did not throw an error.',
    );

    t.same(
      user.property('json'),
      {},
      'Property getter did not return the correct value for json.',
    );
    t.done();
  },

  propertySetter: function(t) {
    const user = new UserMockup();
    const controlUser = new UserMockup();
    t.expect(6);

    t.same(
      user.property('email', 123),
      '',
      'Setting a property did not return the new value that was set (with casting).',
    );

    user.property('email', 'asdasd');
    t.equals(
      user.property('email'),
      'asdasd',
      'Setting a property did not actually set the property to the correct value',
    );

    user.property('email', 'test@test.de');
    t.ok(
      user.property('email') !== controlUser.property('email'),
      'Creating a new instance of an Object does not create fresh properties.',
    );

    user.property({
      name: 'objectTest',
      email: 'object@test.de',
    });

    t.equals(
      user.property('name'),
      'objectTest',
      'Setting multiple properties by providing one object did not work correctly for the name.',
    );
    t.equals(
      user.property('email'),
      'object@test.de',
      'Setting multiple properties by providing one object did not work correctly for the email.',
    );

    user.property('json', {
      test: 1,
    });

    t.equals(
      user.property('json').test,
      1,
      'Setting a json property did not work correctly.',
    );

    t.done();
  },

  propertyDiff: function(t) {
    const user = new UserMockup();
    const beforeName = user.property('name');
    const afterName = 'hurgelwurz';
    const beforeEmail = user.property('email');
    const afterEmail = 'email.propertyDiff@test';
    t.expect(5);
    const shouldName = [
      {
        key: 'name',
        before: beforeName,
        after: afterName,
      },
    ];
    const shouldMail = [
      {
        key: 'email',
        before: beforeEmail,
        after: afterEmail,
      },
    ];
    const shouldNameAndMail = shouldName.concat(shouldMail);

    t.ok(
      user.propertyDiff(),
      'Property diff returned changes even though there were none',
    );

    user.property('name', afterName);
    t.same(
      shouldName,
      user.propertyDiff(),
      'Property diff did not correctly recognize the changed property `name`.',
    );

    user.property('email', afterEmail);
    t.same(
      shouldName,
      user.propertyDiff('name'),
      'Property diff did not correctly filter for changes only in `name`.',
    );

    t.same(
      shouldNameAndMail,
      user.propertyDiff(),
      'Property diff did not correctly recognize the changed properties `name` and `email`.',
    );

    user.property('name', beforeName);
    t.same(
      shouldMail,
      user.propertyDiff(),
      'Property diff did not correctly recognize the reset property `name`.',
    );

    t.done();
  },

  propertyReset: function(t) {
    const user = new UserMockup();
    const beforeName = user.property('name');
    const beforeEmail = user.property('email');
    t.expect(3);

    user.property('name', user.property('name') + 'hurgelwurz');
    user.property('email', user.property('email') + 'asdasd');
    user.propertyReset('name');
    t.same(
      user.property('name'),
      beforeName,
      'Property reset did not properly reset `name`.',
    );

    t.ok(
      user.property('email') !== beforeEmail,
      "Property reset reset `email` when it shouldn't have.",
    );

    user.property('name', user.property('name') + 'hurgelwurz');
    user.propertyReset();
    t.ok(
      user.property('name') === beforeName &&
        user.property('email') === beforeEmail,
      'Property reset did not properly reset `name` and `email`.',
    );

    t.done();
  },

  allProperties: function(t) {
    const user = new UserMockup();
    t.expect(1);

    user.property('name', 'hurgelwurz');
    user.property('email', 'hurgelwurz@test.de');
    const should = {
      name: user.property('name'),
      visits: user.property('visits'),
      email: user.property('email'),
      emailOptional: user.property('emailOptional'),
      country: user.property('country'),
      json: {},
      id: user.id,
    };
    t.same(should, user.allProperties(), 'Getting all properties failed.');

    t.done();
  },
};

exports.create = async (t) => {
  const user = new UserMockup();
  t.expect(5);

  user.property('name', 'createTest');
  user.property('email', 'createTest@asdasd.de');

  t.doesNotThrow(async () => {
    // TODO: when upgrading to a better test framework, async errors need to be handled
    // right now the promise rejections from this lead to a unhandledPromiseRejection
    await user.save();

    redis.hgetall(prefix + ':hash:UserMockup:' + user.id, function(err, value) {
      t.ok(!err, 'There was a redis error in the create test check.');
      t.ok(
        value.name.toString() === 'createTest',
        'The user name was not saved properly',
      );
      t.ok(
        value.visits.toString() === '0',
        'The user visits were not saved properly',
      );
      t.ok(
        value.email.toString() === 'createTest@asdasd.de',
        'The user email was not saved properly',
      );
      t.done();
    });
  }, 'Creating a user did not work.:' + user.errors);
};

exports.remove = async (t) => {
  const user = new UserMockup();
  let testExists;
  t.expect(7);

  testExists = function(what, key, callback) {
    redis.exists(key, function(err, value) {
      t.ok(!err, 'There was a redis error in the remove test check.');
      t.ok(
        value === 0,
        'Deleting a user did not work: ' + what + ', key: ' + key,
      );
      callback();
    });
  };

  user.property('name', 'deleteTest');
  user.property('email', 'deleteTest@asdasd.de');
  await user.save();

  const id = user.id;
  await user.remove();

  t.equals(
    user.id,
    null,
    'Removing an object from the db did not set the id to null',
  );
  async.series(
    [
      function(callback) {
        testExists('hashes', prefix + ':hash:UserMockup:' + id, callback);
      },
      function(callback) {
        redis.sismember(
          prefix + ':index:UserMockup:name:' + user.property('name'),
          id,
          function(err, value) {
            t.ok(
              err === null && value === 0,
              'Deleting a model did not properly delete the normal index.',
            );
          },
        );
        callback();
      },
      function(callback) {
        redis.zscore(prefix + ':scoredindex:UserMockup:visits', id, function(
          err,
          value,
        ) {
          t.ok(
            err === null && value === null,
            'Deleting a model did not properly delete the scored index.',
          );
        });
        callback();
      },
      function(callback) {
        testExists(
          'uniques',
          prefix + ':uniques:UserMockup:name:' + user.property('name'),
          callback,
        );
      },
    ],
    t.done,
  );
};

exports.idSets = async (t) => {
  const user = new UserMockup();
  let tmpid = 0;
  t.expect(4);
  user.property('name', 'idSetTest');

  await user.save();
  tmpid = user.id;
  redis.sismember(
    prefix + ':idsets:' + user.modelName,
    tmpid,
    async (err, value) => {
      t.ok(!err, 'There was an unexpected redis error.');
      t.equals(value, 1, 'The userid was not part of the idset after saving.');
      await user.remove();
      redis.sismember(
        prefix + ':idsets:' + user.modelName,
        tmpid,
        (err, value) => {
          t.ok(!err, 'There was an unexpected redis error.');
          t.equals(
            value,
            0,
            'The userid was still part of the idset after removing.',
          );
          t.done();
        },
      );
    },
  );
};

exports.update = async (t) => {
  const user = new UserMockup();
  t.expect(3);

  user.property('name', 'updateTest1');
  user.property('email', 'updateTest1@email.de');
  await user.save();
  user.property('name', 'updateTest2');
  user.property('email', 'updateTest2@email.de');
  await user.save();
  redis.hgetall(prefix + ':hash:UserMockup:' + user.id, function(err, value) {
    t.ok(!err, 'There was a redis error in the update test check.');
    if (err) {
      t.done();
    }
    t.ok(
      value.name.toString() === 'updateTest2',
      'The user name was not updated properly',
    );
    t.ok(
      value.email.toString() === 'updateTest2@email.de',
      'The user email was not updated properly',
    );
    t.done();
  });
};

exports.unique = async (t) => {
  const user1 = new UserMockup();
  const user2 = new UserMockup();
  t.expect(8);

  user1.property('name', 'duplicateTest');
  user1.property('email', 'duplicateTest@test.de');
  user2.property('name', 'duplicateTest');
  user2.property('email', 'dubplicateTest@test.de'); // intentional typo dub
  await user1.save();
  redis.get(
    prefix + ':uniques:UserMockup:name:duplicatetest',
    async (err, value) => {
      t.ok(user1.id, 'Userid b0rked while checking uniques');
      t.equals(
        parseInt(value, 10),
        user1.id,
        'The unique key did not have the correct id',
      );
      const valid = await user2.validate(false, false);
      t.ok(
        !valid,
        'A unique property was not recognized as a duplicate in valid without setDirectly',
      );
      try {
        await user2.save();
        t.ok(
          false,
          'Saving a model with an invalid non-unique property did not throw/reject.',
        );
      } catch (err) {
        t.ok(
          err instanceof nohm.ValidationError,
          'A saved unique property was not recognized as a duplicate',
        );
        t.same(
          err.errors.name,
          ['notUnique'],
          'A saved unique property was not recognized as a duplicate',
        );

        redis.exists(
          prefix + ':uniques:UserMockup:email:dubbplicatetest@test.de',
          (err, value) => {
            t.equals(
              value,
              0,
              'The tmp unique lock was not deleted for a failed save.',
            );
            redis.get(
              prefix + ':uniques:UserMockup:name:duplicatetest',
              (err, value) => {
                t.ok(
                  !err,
                  'There was an unexpected probllem: ' + util.inspect(err),
                );
                t.same(
                  parseInt(value, 10),
                  user1.id,
                  'The unique key did not have the correct id after trying to save another unique.',
                );
                t.done();
              },
            );
          },
        );
      }
    },
  );
};

exports.uniqueLowerCase = async (t) => {
  const user1 = new UserMockup();
  const user2 = new UserMockup();
  t.expect(5);

  user1.property('name', 'LowerCaseTest');
  user1.property('email', 'LowerCaseTest@test.de');
  user2.property('name', 'lowercasetest');
  user2.property('email', 'lowercasetest@test.de');
  await user1.save();
  redis.get(
    prefix + ':uniques:UserMockup:name:' + user1.property('name').toLowerCase(),
    async (err, value) => {
      t.equals(
        parseInt(value, 10),
        user1.id,
        'The unique key did not have the correct id',
      );
      const valid = await user2.validate(false, false);
      t.ok(
        !valid,
        'A unique property was not recognized as a duplicate in valid without setDirectly.',
      );
      try {
        await user2.save();
        t.ok(
          false,
          'Saving a model with an invalid non-unique property did not throw/reject.',
        );
      } catch (err) {
        t.ok(
          err instanceof nohm.ValidationError,
          'A saved unique property was not recognized as a duplicate',
        );
        redis.get(prefix + ':uniques:UserMockup:name:lowercasetest', function(
          err,
          value,
        ) {
          t.ok(!err, 'There was an unexpected probllem: ' + util.inspect(err));
          t.same(
            parseInt(value, 10),
            user1.id,
            'The unique key did not have the correct id after trying to save another unique.',
          );
          t.done();
        });
      }
    },
  );
};

exports.uniqueDeleteWhenOtherFails = async (t) => {
  const user = new UserMockup();
  t.expect(2);

  user.property('name', 'uniqueDeleteTest');
  user.property('email', 'uniqueDeleteTest@test.de');
  user.property('country', '');
  try {
    await user.save();
  } catch (err) {
    t.ok(
      err instanceof nohm.ValidationError,
      'There was an unexpected problem: ' + util.inspect(err),
    );
    redis.exists(
      prefix +
        ':uniques:UserMockup:name:' +
        user.property('name').toLowerCase(),
      function(err, value) {
        t.equals(
          value,
          0,
          'The unique was locked although there were errors in the non-unique checks.',
        );
        t.done();
      },
    );
  }
};

exports.uniqueOnlyCheckSpecified = async (t) => {
  const user = new UserMockup();
  t.expect(2);

  // TODO: make test work on own user, not on user of another test
  user.property('name', 'duplicateTest');
  user.property('email', 'duplicateTest@test.de');
  const valid = await user.validate('name');
  t.same(valid, false, 'Checking the duplication status failed in valid().');
  t.same(
    user.errors.email,
    [],
    'Checking the duplication status of one property set the error for another one.',
  );
  t.done();
};

exports.uniqueDeletion = async (t) => {
  const user = new UserMockup();
  t.expect(2);

  user.property({
    name: 'dubplicateDeletionTest',
    email: 'dubplicateDeletionTest@test.de',
    country: '',
  });

  try {
    await user.save();
  } catch (err) {
    t.ok(err, 'The invalid property country did not trigger a failure.');
    redis.exists(
      prefix + ':uniques:UserMockup:name:dubplicateDeletionTest',
      function(err, value) {
        t.equals(
          value,
          0,
          'The tmp unique key was not deleted if a non-unique saving failure occured.',
        );
        t.done();
      },
    );
  }
};

exports.uniqueCaseInSensitive = async (t) => {
  const user = new UserMockup();
  const user2 = new UserMockup();
  t.expect(3);

  user.property({
    name: 'uniqueCaseInSensitive',
    email: 'uniqueCaseInSensitive@test.de',
  });
  user2.property({
    name: user.property('name').toLowerCase(),
    email: user.property('email').toLowerCase(),
  });

  await user.save();
  const valid = await user2.validate();
  t.ok(!valid, 'A duplicate (different case) unique property was validated.');
  t.same(
    user2.errors.name,
    ['notUnique'],
    'The error for name was not correct.',
  );
  t.same(
    user2.errors.email,
    ['notUnique'],
    'The error for email was not correct.',
  );
  t.done();
};

exports.uniqueEmpty = async (t) => {
  const user = new UserMockup();
  t.expect(4);

  redis.exists(
    prefix + ':uniques:UserMockup:emailOptional:',
    async (err, exists) => {
      t.ok(!err, 'redis.keys failed.');
      t.same(
        exists,
        0,
        'An empty unique was set before the test for it was run',
      );
      user.property({
        name: 'emailOptional',
        email: 'emailOptionalTest@test.de',
        emailOptional: '',
      });
      await user.save();
      redis.keys(prefix + ':uniques:UserMockup:emailOptional:', function(
        err,
        keys,
      ) {
        t.ok(!err, 'redis.keys failed.');
        t.same(keys.length, 0, 'An empty unique was set');
        t.done();
      });
    },
  );
};

exports['integer uniques'] = async (t) => {
  t.expect(3);
  const obj = await nohm.factory('UniqueInteger');
  const obj2 = await nohm.factory('UniqueInteger');
  obj.property('unique', 123);
  obj2.property('unique', 123);

  await obj.save();
  t.same(
    obj.allProperties(),
    {
      unique: 123,
      id: obj.id,
    },
    'Properties not correct',
  );
  try {
    await obj2.save();
  } catch (err) {
    t.ok(
      err instanceof nohm.ValidationError,
      'Unique integer conflict did not result in error.',
    );
    await obj.remove();
    t.doesNotThrow(async () => {
      await obj2.save();
      t.done();
    });
  }
};

exports.indexes = async (t) => {
  const user = new UserMockup();
  t.expect(6);

  user.property('name', 'indexTest');
  user.property('email', 'indexTest@test.de');
  user.property('country', 'indexTestCountry');
  user.property('visits', 20);

  await user.save();
  redis.sismember(
    prefix + ':index:UserMockup:country:indexTestCountry',
    user.id,
    function(err, value) {
      t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
      t.ok(
        value === 1,
        'The country index did not have the user as one of its ids.',
      );
      redis.zscore(prefix + ':scoredindex:UserMockup:visits', user.id, function(
        err,
        value,
      ) {
        t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
        t.ok(
          value == user.property('visits'),
          'The visits index did not have the correct score.',
        );
        redis.sismember(
          prefix + ':index:UserMockup:visits:' + user.property('visits'),
          user.id,
          function(err, value) {
            t.ok(!err, 'There was an unexpected problem: ' + util.inspect(err));
            t.ok(
              value === 1,
              'The visits index did not have the user as one of its ids.',
            );
            t.done();
          },
        );
      });
    },
  );
};

exports.__updated = async (t) => {
  const user = new UserMockup();
  t.expect(3);
  await user.save();
  user.property('name', 'hurgelwurz');
  t.ok(
    user.properties.get('name').__updated === true,
    '__updated was not ser on property `name`.',
  );
  user.property('name', 'test');
  t.ok(
    user.properties.get('name').__updated === false,
    "Changing a var manually to the original didn't reset the internal __updated var",
  );
  await user.remove();

  const user2 = new UserMockup();
  user2.property('name', 'hurgelwurz');
  user2.propertyReset();
  t.ok(
    user2.properties.get('name').__updated === false,
    "Changing a var by propertyReset to the original didn't reset the internal __updated var",
  );
  t.done();
};

exports.deleteNonExistant = async (t) => {
  const user = new UserMockup();
  t.expect(1);
  user.id = 987654321;

  try {
    await user.remove();
    t.fail('Removing a user that should not exist did not throw an error.');
  } catch (err) {
    t.same(
      err,
      new Error('not found'),
      'Trying to delete an instance that doesn\'t exist did not return "not found".',
    );
  }
  t.done();
};

const MethodOverwrite = nohm.model('methodOverwrite', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'test',
      unique: true,
      validations: ['notEmpty'],
    },
  },
  methods: {
    test: function test() {
      return this.property('name');
    },
  },
});

exports.methods = async (t) => {
  const methodOverwrite = new MethodOverwrite();
  t.expect(2);

  t.same(
    typeof methodOverwrite.test,
    'function',
    'Adding a method to a model did not create that method on a new instance.',
  );
  t.same(
    methodOverwrite.test(),
    methodOverwrite.property('name'),
    "The test method did not work properly. (probably doesn't have the correct `this`.",
  );
  t.done();
  console.warn(
    '\x1b[1m\x1b[34m%s\x1b[0m',
    'There should be 2 warnings in the next few lines somewhere.',
  );
};

const MethodOverwriteSuperMethod = nohm.model(
  'methodOverwriteSuperMethod',
  {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'test',
        unique: true,
        validations: ['notEmpty'],
      },
    },
    methods: {
      prop: function prop(name) {
        if (name === 'super') return this._super_prop('name');
        else return this._super_prop.apply(this, arguments, 0);
      },
    },
  },
  true,
); // temporary to prevent connectMiddleware later from throwing a bunch of deprecation warnings
exports.methodsSuper = async (t) => {
  const methodOverwrite = new MethodOverwriteSuperMethod();
  t.expect(4);

  t.same(
    typeof methodOverwrite.prop,
    'function',
    'Overwriting a method in a model definition did not create that method on a new instance.',
  );
  t.same(
    typeof methodOverwrite._super_prop,
    'function',
    'Overwriting a method in a model definition did not create the _super_ method on a new instance.',
  );
  t.same(
    methodOverwrite.prop('super'),
    methodOverwrite.property('name'),
    'The super test method did not work properly.',
  );
  methodOverwrite.prop('name', 'methodTest');
  t.same(
    methodOverwrite.property('name'),
    'methodTest',
    'The super test method did not properly handle arguments',
  );
  t.done();
  console.warn(
    '\x1b[1m\x1b[34m%s\x1b[0m',
    'There should be a warning with a stack trace in the next few lines somewhere.',
  );
};

exports['no super method if none needed'] = async (t) => {
  const user = new UserMockup();
  t.expect(1);

  t.ok(
    !user.hasOwnProperty('_super_test'),
    'Defining a method that does not overwrite a nohm method created a _super_.',
  );
  t.done();
};

exports.uniqueDefaultOverwritten = async (t) => {
  const user = new UserMockup();
  const user2 = new UserMockup();
  t.expect(2);

  await user.save();
  try {
    await user2.save();
  } catch (err) {
    t.ok(
      err instanceof nohm.ValidationError,
      'Saving a default unique value did not return with the error "invalid"',
    );
    t.same(
      user2.errors.name,
      ['notUnique'],
      'Saving a default unique value returned the wrong error: ' +
        user2.errors.name,
    );
    t.done();
  }
};

exports.allPropertiesJson = async (t) => {
  const user = new UserMockup();
  user.property('json', { test: 1 });
  user.property({
    name: 'allPropertiesJson',
    email: 'allPropertiesJson@test.de',
  });
  t.expect(1);

  await user.save();
  const testProps = user.allProperties();
  t.same(
    testProps.json,
    user.property('json'),
    'allProperties did not properly parse json properties',
  );
  t.done();
};

/*
// TODO: Check which (if any) of these need to be re-enabled
exports.thisInCallbacks = async (t) => {
  const user = new UserMockup();
  let checkCounter = 0;
  const checkSum = 11;
  var checkThis = function (name, cb) {
    return function () {
      checkCounter++;
      t.ok(this instanceof UserMockup, '`this` is not set to the instance in ' + name);
      if (checkCounter === checkSum) {
        done();
      } else if (typeof (cb) === 'function') {
        cb();
      }
    };
  };
  t.expect(checkSum + 1);

  var done = function () {
    user.remove(checkThis('remove', function () {
      t.done();
    }));
  };

  user.save(checkThis('createError', function () {
    user.property({
      name: 'thisInCallbacks',
      email: 'thisInCallbacks@test.de'
    });
    user.link(user, checkThis('link'));
    user.save(checkThis('create', function () {
      user.load(user.id, checkThis('load'));
      user.find({ name: 'thisInCallbacks' }, checkThis('find'));
      user.save(checkThis('update', function () {
        user.property('email', 'asd');
        user.save(checkThis('updateError'));
      }));
      user.belongsTo(user, checkThis('belongsTo'));
      user.getAll('UserMockup', checkThis('getAll'));
      user.numLinks('UserMockup', checkThis('numLinks'));
      user.unlinkAll(null, checkThis('unlinkAll'));
    }));
  }));
};
*/

exports.defaultAsFunction = async (t) => {
  t.expect(3);

  var TestMockup = nohm.model('TestMockup', {
    properties: {
      time: {
        type: 'timestamp',
        defaultValue: function() {
          return +new Date();
        },
      },
    },
  });
  const test1 = new TestMockup();
  setTimeout(function() {
    const test2 = new TestMockup();

    t.ok(
      typeof test1.property('time') === 'string',
      'time of test1 is not a string',
    );
    t.ok(
      typeof test2.property('time') === 'string',
      'time of test2 is not a string',
    );
    t.ok(
      test1.property('time') < test2.property('time'),
      'time of test2 is not lower than test1',
    );
    t.done();
  }, 10);
};

exports.defaultIdGeneration = async (t) => {
  t.expect(1);

  var TestMockup = nohm.model('TestMockup', {
    properties: {
      name: {
        type: 'string',
        defaultValue: 'defaultIdGeneration',
      },
    },
  });
  const test1 = new TestMockup();
  await test1.save();
  t.same(typeof test1.id, 'string', 'The generated id was not a string');
  t.done();
};

/*
 * TODO: Check if this is reasonably possible. Problem is awaiting the constructor is not supported.
 exports.instanceLoad = async (t) => {
   t.expect(1);
   new UserMockup(1123123, function (err) {
     t.same(err, 'not found', 'Instantiating a user with an id and callback did not try to load it');
     t.done();
    });
  };
  */

exports.factory = async (t) => {
  t.expect(3);
  const name = 'UserMockup';
  const user = await nohm.factory(name);
  t.same(
    user.modelName,
    name,
    'Using the factory to get an instance did not work.',
  );

  try {
    await nohm.factory(name, 1234124235);
  } catch (err) {
    t.same(
      err.message,
      'not found',
      'Instantiating a user via factory with an id and callback did not try to load it',
    );
  }
  const nonExistingModelName = 'doesnt exist';
  try {
    await nohm.factory(nonExistingModelName, 1234124235);
  } catch (err) {
    t.same(
      err.message,
      `Model '${nonExistingModelName}' not found.`,
      'Instantiating a user via factory with an id and callback did not try to load it',
    );
    t.done();
  }
};

exports['factory with non-integer id'] = async (t) => {
  t.expect(1);
  const name = 'NonIncrement';
  const obj = await nohm.factory(name);
  obj.property('name', 'factory_non_integer_load');
  await obj.save();

  var obj2 = await nohm.factory(name, obj.id);
  t.same(
    obj2.allProperties(),
    obj.allProperties(),
    'The loaded object seems to have wrong properties',
  );
  t.done();
};

exports.purgeDB = async (t) => {
  t.expect(4);
  var countKeys = function(prefix, callback) {
    redis.keys(prefix + '*', function(err, orig_num) {
      callback(err, orig_num.length);
    });
  };

  const tests = [];
  Object.keys(nohm.prefix).forEach(function(key) {
    if (typeof nohm.prefix[key] === 'object') {
      Object.keys(nohm.prefix[key]).forEach((innerKey) => {
        tests.push(async.apply(countKeys, nohm.prefix[key][innerKey]));
      });
    } else {
      tests.push(async.apply(countKeys, nohm.prefix[key]));
    }
  });

  async.series(tests, async (err, num_arr) => {
    t.ok(!err, 'Unexpected redis error');
    const count = num_arr.reduce(function(num, add) {
      return num + add;
    }, 0);
    t.ok(count > 0, 'Database did not have any keys bevore purgeDb call');
    await nohm.purgeDb();
    async.series(tests, function(err, num_arr) {
      t.ok(!err, 'Unexpected redis error');
      const count = num_arr.reduce(function(num, add) {
        return num + add;
      }, 0);
      t.same(count, 0, 'Database did have keys left after purging.');
      t.done();
    });
  });
};

exports['no key left behind'] = async (t) => {
  const user = await nohm.factory('UserMockup');
  const user2 = await nohm.factory('UserMockup');
  t.expect(3);

  user2.property({
    name: 'user2',
    email: 'user2@test.com',
  });

  user.link(user2);
  user2.link(user, 'father');

  h.cleanUp(redis, args.prefix, () => {
    redis.keys(prefix + ':*', async (err, keys) => {
      t.same(keys.length, 0, 'Not all keys were removed before tests'); // at this point only meta info should be stored
      await user.save();
      await user2.save();
      user.unlink(user2);
      await user2.save();
      await user2.remove();
      await user.remove();
      redis.keys(prefix + ':*', function(err, keys) {
        t.ok(!err, 'Unexpected redis error');
        // we keep the idsets and meta keys (version, idgenerator and properties), so it should be 4 here.
        t.same(keys.length, 4, 'Not all keys were removed from the database');
        t.done();
      });
    });
  });
};

exports['temporary model definitions'] = async (t) => {
  t.expect(2);
  const user = await nohm.factory('UserMockup');

  // new temporary model definition with same name
  var TempUserMockup = nohm.model(
    'UserMockup',
    {
      properties: {
        well_shit: {
          type: 'string',
        },
      },
    },
    true,
  );
  const new_user = new TempUserMockup();

  const user2 = await nohm.factory('UserMockup');

  t.deepEqual(user.allProperties(), user2.allProperties(), 'HURASDASF');
  t.notDeepEqual(user.allProperties(), new_user.allProperties(), 'HURASDASF');
  t.done();
};

exports['changing unique frees old unique with uppercase values'] = async (
  t,
) => {
  t.expect(1);
  const obj = await nohm.factory('UserMockup');
  const obj2 = await nohm.factory('UserMockup');
  const obj3 = await nohm.factory('UserMockup');
  const old = 'Changing Unique Property Frees The Value';
  obj.property('name', old);
  obj.property('email', 'change_frees@unique.de');

  await obj.save();
  await obj2.load(obj.id);
  obj2.property(
    'name',
    'changing unique property frees the value to something else',
  );
  await obj2.save();
  await obj3.load(obj.id);
  obj2.property('name', old);
  try {
    obj2.save();
    // test something, so we at least have the resemblence of normal testing here........
    // the way it actually tests whether the uniques are freed is by not throwing errors during save
    t.same(obj2.id, obj3.id, 'Something went wrong');
  } catch (err) {
    t.ok(
      !err,
      'Unexpected saving error. (May be because old uniques are not freed properly on change.',
    );
  } finally {
    t.done();
  }
};

exports['removing unique frees unique with uppercase values'] = async (t) => {
  t.expect(1);
  const obj = await nohm.factory('UserMockup');
  const obj2 = await nohm.factory('UserMockup');
  const old = 'Removing Unique Property Frees The Value';
  obj.property('name', old);
  obj.property('email', 'remove_frees@unique.de');

  await obj.save();
  await obj.remove(obj.id);
  obj2.property('name', old);
  await obj2.save();
  // test something, so we at least have the resemblence of normal testing here........
  // the way it actually tests whether the uniques are freed is by not throwing errors during save
  t.notEqual(obj.id, obj2.id);
  t.done();
};

exports['register nohm model via ES6 class definition'] = async (t) => {
  try {
    class ClassModel extends Nohm.NohmModel {}
    ClassModel.modelName = 'ClassModel';
    ClassModel.definitions = {
      name: {
        type: 'string',
        unique: true,
      },
    };

    const ModelCtor = nohm.register(ClassModel);
    const instance = new ModelCtor();
    const factoryInstance = await nohm.factory('ClassModel');

    t.same(
      instance.id,
      null,
      'Created model does not have null as id before saving',
    );

    t.same(
      typeof ModelCtor.findAndLoad,
      'function',
      'Created model class does not have static findAndLoad().',
    );
    t.same(
      factoryInstance.modelName,
      'ClassModel',
      'Created factory model does not have the correct modelName.',
    );
    t.same(
      instance.modelName,
      'ClassModel',
      'Created model does not have the correct modelName.',
    );

    instance.property('name', 'registerES6Test');
    await instance.save();
    t.notEqual(
      instance.id,
      null,
      'Created model does not have an id after saving.',
    );

    const staticLoad = await ModelCtor.load(instance.id);
    t.same(
      staticLoad.allProperties(),
      instance.allProperties(),
      'register().load failed.',
    );

    const staticSort = await ModelCtor.sort({ field: 'name' }, [instance.id]);
    t.same(staticSort, [instance.id], 'register().sort failed.');

    const staticFind = await ModelCtor.find({
      name: instance.property('name'),
    });
    t.same(staticFind, [instance.id], 'register().find failed.');

    let staticFindAndLoad = await ModelCtor.findAndLoad({
      name: instance.property('name'),
    });
    t.same(
      staticFindAndLoad[0].allProperties(),
      instance.allProperties(),
      'register().findAndLoad failed.',
    );

    staticFindAndLoad = await ModelCtor.remove(instance.id);
    t.equal(staticFindAndLoad, undefined, 'register().findAndLoad failed.');

    staticFindAndLoad = await ModelCtor.findAndLoad({
      name: instance.property('name'),
    });
    t.same(
      staticFindAndLoad,
      [],
      'register().findAndLoad after remove failed.',
    );

    t.done();
  } catch (err) {
    console.error(err);
    []();
    t.same(false, true);
    t.done();
  }
};

exports['return value of .property() with object'] = async (t) => {
  const user = new UserMockup();
  t.expect(1);

  const object = {
    name: 'propertyWithObjectReturn',
    email: 'propertyWithObjectReturn@test.de',
    visits: '1',
  };

  const properties = user.property(object);

  const compareObject = {
    name: object.name,
    email: object.email,
    visits: 1,
  };
  t.same(
    compareObject,
    properties,
    'The returned properties were not correct.',
  );
  t.done();
};

exports['id always stringified'] = async (t) => {
  t.expect(3);

  const user = new UserMockup();

  t.same(user.id, null, 'Base state of id is not null');
  user.id = 'asd';
  t.same(user.id, 'asd', 'Basic string setter failed');
  user.id = 213;
  t.same(user.id, '213', 'Casting string setter failed');
  t.done();
};

exports['isLoaded'] = async (t) => {
  t.expect(6);

  let user = await nohm.factory('NonIncrement');
  user.property('name', 'isLoadedUser');

  t.same(user.isLoaded, false, 'isLoaded true in base state.');
  user.id = 'asd';
  t.same(user.isLoaded, false, 'isLaoded true after setting manual id');
  await user.save();
  t.same(user.isLoaded, true, 'isLaoded true after setting manual id');
  const id = user.id;
  user = null;

  const loadUser = await nohm.factory('NonIncrement');
  t.same(loadUser.isLoaded, false, 'isLoaded true in base state on loadUser.');
  await loadUser.load(id);
  t.same(loadUser.isLoaded, true, 'isLaoded false after load()');
  loadUser.id = 'asdasd';
  t.same(
    loadUser.isLoaded,
    false,
    'isLaoded true after setting manual id on loaded user',
  );
  t.done();
};

exports['isDirty'] = async (t) => {
  t.expect(13);

  let user = await nohm.factory('UserMockup');
  let other = await nohm.factory('NonIncrement');

  t.same(user.isDirty, false, 'user.isDirty true in base state.');
  t.same(other.isDirty, false, 'other.isDirty true in base state.');

  other.link(user);
  t.same(user.isDirty, false, 'user.isDirty true after other.link(user).');
  t.same(other.isDirty, true, 'other.isDirty false after other.link(user).');

  user.property('name', 'isDirtyUser');
  t.same(user.isDirty, true, 'user.isDirty false after first edit.');
  user.property('email', 'isDirtyUser@test.de');
  t.same(user.isDirty, true, 'user.isDirty false after second.');

  await other.save();
  t.same(user.isDirty, false, 'user.isDirty true after saving.');
  t.same(other.isDirty, false, 'other.isDirty true after saving.');

  user.id = parseInt(user.id, 10);
  t.same(user.isDirty, false, 'user.isDirty true after same id change.');

  t.notEqual(other.id, 'new_id', 'other.id was already test value Oo');
  other.id = 'new_id';
  t.same(other.id, 'new_id', 'other.id change failed.');
  t.same(other.isDirty, true, 'other.isDirty false after id change.');

  const loadUser = await nohm.factory('UserMockup');
  await loadUser.load(user.id);
  t.same(loadUser.isDirty, false, 'loadUser.isDirty was true after load()');

  t.done();
};

exports['create-only failure attempt without load_pure'] = async (t) => {
  t.expect(2);

  nohm.model('withoutLoadPureCreateOnlyModel', {
    properties: {
      createdAt: {
        defaultValue: () => Date.now() + ':' + Math.random(),
        type: (_a, _b, oldValue) => oldValue, // never change the value after creation
      },
    },
  });

  let loadPure = await nohm.factory('withoutLoadPureCreateOnlyModel');
  const initialValue = loadPure.property('createdAt');
  loadPure.property('createdAt', 'asdasd');

  t.same(
    loadPure.property('createdAt'),
    initialValue,
    'Behavior failed to prevent property change',
  );

  await loadPure.save();
  let controlLoadPure = await nohm.factory('withoutLoadPureCreateOnlyModel');
  await controlLoadPure.load(loadPure.id);

  t.notEqual(
    controlLoadPure.property('createdAt'),
    initialValue,
    'create-only loading produced non-cast value (should only happen with load_pure)',
  );

  t.done();
};

exports['loadPure'] = async (t) => {
  t.expect(4);

  nohm.model('loadPureModel', {
    properties: {
      incrementOnChange: {
        defaultValue: 0,
        load_pure: true,
        type: function() {
          return 1 + this.property('incrementOnChange');
        },
      },
      createdAt: {
        defaultValue: () => Date.now() + ':' + Math.random(),
        load_pure: true,
        type: (_a, _b, oldValue) => oldValue, // never change the value after creation
      },
    },
  });

  let loadPure = await nohm.factory('loadPureModel');
  const initialCreatedAt = loadPure.property('createdAt');
  loadPure.property('createdAt', 'asdasd');
  const initialIncrement = loadPure.property('incrementOnChange');
  loadPure.property('incrementOnChange', 'asdasd');
  loadPure.property('incrementOnChange', 'asdasd');
  const incrementedTwice = initialIncrement + 2;

  t.same(
    loadPure.property('incrementOnChange'),
    incrementedTwice,
    'incrementedTwice change did not work',
  );
  t.same(
    loadPure.property('createdAt'),
    initialCreatedAt,
    'Behavior failed to prevent property change',
  );

  await loadPure.save();
  let controlLoadPure = await nohm.factory('loadPureModel');
  await controlLoadPure.load(loadPure.id);
  t.same(
    controlLoadPure.property('incrementOnChange'),
    incrementedTwice,
    'incrementedTwice was changed during load',
  );
  t.same(
    controlLoadPure.property('createdAt'),
    initialCreatedAt,
    'create-only loading produced typecast value',
  );

  t.done();
};

exports['allPorperties() cache is reset on propertyReset()'] = async (t) => {
  t.expect(3);

  let user = await nohm.factory('UserMockup');
  const name = 'allPropertyCacheEmpty';
  const email = 'allPropertyCacheEmpty@test.de';
  user.property({
    name,
    email,
  });
  const test = user.allProperties();
  user.propertyReset();

  t.notEqual(user.property('name'), name, 'Name was not reset.');
  t.same(test.name, name, 'Name was reset in  test object.');

  const control = user.allProperties();
  t.notDeepEqual(test, control, 'allProperties cache was not reset properly');
  t.done();
};

exports['allPorperties() cache is reset on propertyReset()'] = async (t) => {
  t.expect(4);

  const loadPureModel = nohm.model(
    'loadPureModel',
    {
      properties: {
        incrementOnChange: {
          defaultValue: 0,
          load_pure: true,
          type: function() {
            return 1 + this.property('incrementOnChange');
          },
        },
        createdAt: {
          defaultValue: () => Date.now() + ':' + Math.random(),
          load_pure: true,
          type: (_a, _b, oldValue) => oldValue, // never change the value after creation
        },
      },
    },
    true,
  );

  let loadPure = new loadPureModel();
  const initialCreatedAt = loadPure.property('createdAt');
  const initialIncrement = loadPure.property('incrementOnChange');
  loadPure.property('incrementOnChange', 'asdasd');
  loadPure.property('incrementOnChange', 'asdasd');
  const incrementedTwice = initialIncrement + 2;

  t.same(
    loadPure.allProperties().incrementOnChange,
    incrementedTwice,
    `allProperties() didn't have incrementOnChange property`,
  );
  t.same(
    loadPure.allProperties().createdAt,
    initialCreatedAt,
    `allProperties() didn't have createdAt property`,
  );

  await loadPure.save();

  let controlLoadPure = new loadPureModel();
  await controlLoadPure.load(loadPure.id);
  t.same(
    controlLoadPure.allProperties().incrementOnChange,
    incrementedTwice,
    `allProperties() didn't have correct incrementOnChange after load`,
  );
  t.same(
    controlLoadPure.allProperties().createdAt,
    initialCreatedAt,
    `allProperties() didn't have correct createdAt after load`,
  );

  t.done();
};

exports['id with : should fail'] = async (t) => {
  t.expect(1);

  const wrongIdModel = nohm.model(
    'wrongIdModel',
    {
      properties: {
        name: {
          type: 'string',
        },
      },
      idGenerator: () => {
        return 'foo:bar';
      },
    },
    true,
  );

  let instance = new wrongIdModel();

  try {
    await instance.save();
  } catch (e) {
    t.same(
      e.message,
      'Nohm IDs cannot contain the character ":". Please change your idGenerator!',
      'Error thrown by wrong id was wrong.',
    );
  }

  t.done();
};

exports['manually setting id should allow saving with uniques'] = async (t) => {
  // see https://github.com/maritz/nohm/issues/82 for details
  t.expect(1);

  const props = {
    name: 'manualIdWithuniques',
    email: 'manualIdWithuniques@example.com',
  };

  let origInstance = new UserMockup();
  origInstance.property(props);
  await origInstance.save();

  let instance = new UserMockup();
  instance.id = origInstance.id;
  instance.property(props);

  await instance.save();
  // just getting here means we pass. do a dummy test just to make a test run
  t.same(instance.id, origInstance.id, 'Something went horribly wrong.');

  t.done();
};

exports['helpers.checkEqual generic tests'] = (t) => {
  const checkEqual = require('../tsOut/helpers').checkEqual;

  t.same(checkEqual(false, true), false, 'false, true');
  t.same(checkEqual(true, false), false, 'true, false');
  t.ok(checkEqual(true, true), 'true, true');
  t.ok(checkEqual(false, false), 'false, false');

  const test1 = new UserMockup();
  const test2 = new UserMockup();

  t.same(
    checkEqual(test1, test2),
    false,
    `Model instances that don't have an id were identified as equal.`,
  );
  test1.id = 'asd';
  test2.id = test1.id;
  t.ok(
    checkEqual(test1, test2),
    `Model instances that DO have an id were identified as NOT equal.`,
  );

  t.done();
};

exports['helpers.checkEqual uses Object.hasOwnProperty for safety'] = async (
  t,
) => {
  t.expect(1);

  const checkEqual = require('../tsOut/helpers').checkEqual;

  const test1 = Object.create(null);
  const test2 = {};

  // checkEqual throws an error here if it's not using Object.hasOwnProperty()
  t.same(checkEqual(test1, test2), false, 'Something is wrong');

  t.done();
};

exports['helpers.callbackError'] = (t) => {
  const callbackError = require('../tsOut/helpers').callbackError;

  t.throws(
    () => {
      callbackError(() => {});
    },
    /^Callback style has been removed. Use the returned promise\.$/,
    'Does not throw when given only function',
  );
  t.throws(
    () => {
      callbackError('foo', 'bar', 'baz', () => {});
    },
    /^Callback style has been removed. Use the returned promise\.$/,
    'Does not throw when last of 4 is function.',
  );
  t.doesNotThrow(() => {
    callbackError('foo', 'bar', 'baz');
  }, 'Error thrown even though arguments contained no function.');
  t.doesNotThrow(() => {
    callbackError(() => {}, 'bar', 'baz');
  }, 'Error thrown even though last argument was not a function.');

  t.done();
};
