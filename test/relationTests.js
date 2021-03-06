var nohm = require(__dirname + '/../tsOut/').Nohm;
var args = require(__dirname + '/testArgs.js');
var async = require('async');
var redis = args.redis;
var h = require(__dirname + '/helper.js');
var relationsprefix = nohm.prefix.relations;
var UserLinkMockup = nohm.model('UserLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'testName',
      validations: ['notEmpty'],
    },
  },
});
var CommentLinkMockup = nohm.model('CommentLinkMockup', {
  properties: {
    text: {
      type: 'string',
      defaultValue: 'this is a comment! REALLY!',
      validations: ['notEmpty'],
    },
  },
});
var RoleLinkMockup = nohm.model('RoleLinkMockup', {
  properties: {
    name: {
      type: 'string',
      defaultValue: 'user',
    },
  },
});

exports.relation = {
  setUp: function(next) {
    if (!nohm.client) {
      nohm.setClient(redis);
    }
    next();
  },
  tearDown: function(next) {
    h.cleanUp(redis, args.prefix, next);
  },

  instances: (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      role2;

    t.expect(2);

    role.link(user);

    t.ok(
      role.relationChanges !== user.relationChanges,
      'Instances share the relationchanges, initiate them as an empty array in the constructor.',
    );

    role2 = new RoleLinkMockup();
    t.same(
      role2.relationChanges,
      [],
      'Creating a new instance does not reset the relationchanges of that instance.',
    );

    t.done();
  },

  link: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      role2 = new RoleLinkMockup(),
      linkCallbackCalled = false,
      linkCallbackCalled2 = false;
    t.expect(14);

    user.link(role, function(action, on, name, obj) {
      linkCallbackCalled = true;
      t.equals(
        action,
        'link',
        'The argument "action" given to the link callback are not correct',
      );
      t.equals(
        on,
        'UserLinkMockup',
        'The argument "on" given to the link callback are not correct',
      );
      t.equals(
        name,
        'default',
        'The argument "name" given to the link callback are not correct',
      );
      t.same(
        obj,
        role,
        'The argument "obj" given to the link callback are not correct',
      );
    });

    role2.property('name', 'test');

    user.link(role2, function() {
      linkCallbackCalled2 = true;
    });

    await user.save();

    t.ok(
      linkCallbackCalled,
      'The provided callback for linking was not called.',
    );
    t.ok(
      linkCallbackCalled2,
      'The provided callback for the second(!) linking was not called.',
    );
    redis.keys(relationsprefix + '*', function(err, values) {
      const keyCheck = function(compareIds) {
        return (err, members) => {
          t.equals(
            members.length,
            compareIds.length,
            'The set of a relationship contained the wrong amount of ids.',
          );
          members.forEach((member) => {
            t.ok(
              compareIds.includes(member),
              'The set of a relationship contained a wrong id',
            );
          });
        };
      };
      if (!err) {
        t.same(
          values.length,
          3,
          'Linking an object did not create the correct number of keys.',
        );
        values.forEach((value) => {
          const isForeignLink = value.includes(':defaultForeign:');
          // user links to role1 and role2, each role links to only user
          const ids = isForeignLink ? [user.id] : [role.id, role2.id];
          redis.smembers(value.toString(), keyCheck(ids));
        });
        t.done();
      } else {
        console.dir(err);
        t.done();
      }
    });
  },

  unlink: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      role2 = new RoleLinkMockup(),
      unlinkCallbackCalled = false,
      unlinkCallbackCalled2 = false;
    t.expect(7);

    user.id = 1;
    role.id = 1;
    role2.id = 2;

    user.unlink(role, function(action, on, name, obj) {
      unlinkCallbackCalled = true;
      t.equals(
        action,
        'unlink',
        'The argument "action" given to the unlink callback are not correct',
      );
      t.equals(
        on,
        'UserLinkMockup',
        'The argument "on" given to the unlink callback are not correct',
      );
      t.equals(
        name,
        'default',
        'The argument "name" given to the unlink callback are not correct',
      );
      t.equals(
        obj,
        role,
        'The argument "obj" given to the unlink callback are not correct',
      );
    });

    user.unlink(role2, function() {
      unlinkCallbackCalled2 = true;
    });

    await user.save();
    t.ok(
      unlinkCallbackCalled,
      'The provided callback for unlinking was not called.',
    );
    t.ok(
      unlinkCallbackCalled2,
      'The provided callback for the second(!) unlinking was not called.',
    );
    redis.keys(relationsprefix + '*', function(err, value) {
      if (!err) {
        var check =
          (Array.isArray(value) && value.length === 0) || value === null;
        t.ok(check, 'Unlinking an object did not delete keys.');
      }
      t.done();
    });
  },

  deeplink: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      comment = new CommentLinkMockup(),
      userLinkCallbackCalled = false,
      commentLinkCallbackCalled = false;
    t.expect(5);

    role.link(user, function() {
      userLinkCallbackCalled = true;
    });
    user.link(comment, function() {
      commentLinkCallbackCalled = true;
    });

    await role.save();
    t.ok(userLinkCallbackCalled, 'The user link callback was not called.');
    t.ok(
      commentLinkCallbackCalled,
      'The comment link callback was not called.',
    );
    t.ok(
      user.id !== null,
      'The deeplinked user does not have an id and thus is probably not saved correctly.',
    );
    t.ok(
      comment.id !== null,
      'The deeplinked comment does not have an id and thus is probably not saved correctly.',
    );
    redis.smembers(
      relationsprefix +
        comment.modelName +
        ':defaultForeign:' +
        user.modelName +
        ':' +
        comment.id,
      function(err, value) {
        if (!err) {
          t.equals(
            value,
            user.id,
            'The user does not have the neccessary relations saved. There are probably more problems, if this occurs.',
          );
        } else {
          console.dir(err);
        }
        t.done();
      },
    );
  },

  removeUnlinks: async (t) => {
    // uses unlinkAll in remove
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      role2 = new RoleLinkMockup(),
      comment = new CommentLinkMockup(),
      linkName = 'creator';
    t.expect(6);

    user.property('name', 'removeUnlinks');

    role.link(user, linkName);
    user.link(role, 'isA');
    user.link(comment);
    role2.link(user);

    await role2.save();
    var tmpid = user.id;

    await user.remove();
    async.parallel(
      [
        function(next) {
          redis.exists(
            relationsprefix +
              user.modelName +
              ':' +
              linkName +
              'Foreign:' +
              role.modelName +
              ':' +
              tmpid,
            function(err, value) {
              t.equals(
                value,
                0,
                'The foreign link to the custom-link-name role was not deleted',
              );
              next(err);
            },
          );
        },
        function(next) {
          redis.exists(
            relationsprefix +
              role.modelName +
              ':' +
              linkName +
              ':' +
              user.modelName +
              ':' +
              role.id,
            function(err, value) {
              t.equals(
                value,
                0,
                'The link to the custom-link-name role was not deleted',
              );
              next(err);
            },
          );
        },
        function(next) {
          redis.exists(
            relationsprefix +
              user.modelName +
              ':default:' +
              comment.modelName +
              ':' +
              tmpid,
            function(err, value) {
              t.equals(
                value,
                0,
                'The link to the child comment was not deleted',
              );
              next(err);
            },
          );
        },
        function(next) {
          redis.sismember(
            relationsprefix +
              comment.modelName +
              ':defaultForeign:' +
              user.modelName +
              ':' +
              comment.id,
            tmpid,
            function(err, value) {
              t.equals(
                value,
                0,
                'The link to the comment parent was not deleted',
              );
              next(err);
            },
          );
        },
        function(next) {
          redis.sismember(
            relationsprefix +
              role2.modelName +
              ':default:' +
              user.modelName +
              ':' +
              role2.id,
            tmpid,
            function(err, value) {
              t.equals(
                value,
                0,
                'The removal did not delete the link from a parent to the object itself.',
              );
              next(err);
            },
          );
        },
      ],
      function(err) {
        t.ok(!err, 'An unexpected redis error occured.');
        t.done();
      },
    );
  },

  belongsTo: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup();
    t.expect(1);

    user.link(role);

    await user.save();
    const belongs = await user.belongsTo(role);
    t.equals(
      belongs,
      true,
      'The link was not detected correctly by belongsTo()',
    );
    t.done();
  },

  getAll: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      role2 = new RoleLinkMockup();
    t.expect(2);

    user.link(role);
    user.link(role2);

    await user.save();
    var should = [role.id, role2.id].sort();
    const relationIds = await user.getAll(role.modelName);
    t.ok(Array.isArray(relationIds), 'getAll() did not return an array.');
    t.same(
      relationIds.sort(),
      should,
      'getAll() did not return the correct array',
    );
    t.done();
  },

  'getAll with different id generators': async (t) => {
    var user = new UserLinkMockup(),
      comment = new CommentLinkMockup();
    t.expect(1);

    user.link(comment);

    await user.save();
    var should = [comment.id];
    const relationIds = await user.getAll(comment.modelName);
    t.same(relationIds, should, 'getAll() did not return the correct array');
    t.done();
  },

  numLinks: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      role2 = new RoleLinkMockup();
    t.expect(1);

    user.link(role);
    user.link(role2);

    await user.save();
    const numLinks = await user.numLinks(role.modelName);
    t.same(numLinks, 2, 'The number of links was not returned correctly');
    t.done();
  },

  deeplinkError: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      comment = new CommentLinkMockup();
    t.expect(8);

    role.link(user);
    user.link(comment);
    comment.property('text', ''); // makes the comment fail

    try {
      await role.save();
    } catch (err) {
      t.ok(
        user.id !== null,
        'The deeplinked user does not have an id and thus is probably not saved correctly.',
      );
      t.same(
        comment.id,
        null,
        'The deeplinked erroneous comment does not have an id and thus is probably saved.',
      );
      t.ok(
        err instanceof nohm.LinkError,
        'The deeplinked comment did not produce a top-level LinkError.',
      );
      t.same(
        err.errors.length,
        1,
        'The deeplinked role did not fail in a child or reported it wrong.',
      );
      t.ok(
        err.errors[0].error instanceof nohm.ValidationError,
        'The deeplinked comment did not produce a ValidationError.',
      );
      t.same(
        err.errors[0].child.errors,
        { text: ['notEmpty'] },
        'The deeplinked role did not fail.',
      );
      t.same(
        err.errors[0].child.modelName,
        'CommentLinkMockup',
        'The deeplinked role failed in the wrong model or reported it wrong.',
      );
      t.same(
        err.errors[0].parent.modelName,
        'UserLinkMockup',
        'The deeplinked role failed in the wrong model or reported it wrong.',
      );
      t.done();
    }
  },

  linkToSelf: async (t) => {
    var user = new UserLinkMockup();
    t.expect(1);

    user.link(user);

    await user.save();
    t.ok(true, 'Linking an object to itself failed.');
    t.done();
  },

  deppLinkErrorCallback: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      comment = new CommentLinkMockup();
    t.expect(7);

    role.link(user, {
      error: function(err, obj) {
        console.log(err, obj.errors, obj.allProperties());
        t.ok(
          false,
          'Error callback for role.link(user) called even though user is valid.',
        );
      },
    });
    user.link(comment, {
      error: function(err, obj) {
        t.ok(
          err instanceof nohm.ValidationError,
          'err in error callback was not a ValidationError',
        );
        t.same(comment, obj, 'obj in Error callback was not the right object.');
      },
    });
    comment.property('text', ''); // makes the comment fail

    try {
      await role.save();
    } catch (err) {
      t.ok(
        user.id !== null,
        'The deeplinked user does not have an id and thus is probably not saved correctly.',
      );
      t.same(
        comment.id,
        null,
        'The deeplinked erroneous comment does not have an id and thus is probably saved.',
      );
      t.ok(err, 'The deeplinked role did not fail.');
      t.ok(
        err instanceof nohm.LinkError,
        true,
        'The deeplinked role did not fail in a child or reported it wrong.',
      );
      t.same(
        err.errors[0].child.modelName,
        'CommentLinkMockup',
        'The deeplinked role failed in the wrong model or reported it wrong.',
      );
      t.done();
    }
  },

  contineOnError: async (t) => {
    var user = new UserLinkMockup(),
      role = new RoleLinkMockup(),
      comment = new CommentLinkMockup(),
      comment2 = new CommentLinkMockup(),
      comment3 = new CommentLinkMockup();
    t.expect(9);

    role.link(user, {
      error: function(err, obj) {
        console.log(err, obj.errors, obj.allProperties());
        t.ok(
          false,
          'Error callback for role.link(user) called even though user is valid.',
        );
      },
    });
    user.link(comment, {
      error: function(err, obj) {
        t.ok(
          err instanceof nohm.ValidationError,
          'err in error callback was not a ValidationError',
        );
        t.same(comment, obj, 'obj in Error callback was not the right object.');
      },
    });
    user.link(comment2, {
      error: function(err, obj) {
        console.log(err, obj.errors, obj.allProperties());
        t.ok(
          false,
          'Error callback for comment2.link(user) called even though user is valid.',
        );
      },
    });
    user.link(comment3, {
      error: function(err, obj) {
        console.log(err, obj.errors, obj.allProperties());
        t.ok(
          false,
          'Error callback for comment3.link(user) called even though user is valid.',
        );
      },
    });
    comment.property('text', ''); // makes the first comment fail

    try {
      await role.save();
      t.done();
    } catch (e) {
      t.ok(
        e instanceof nohm.LinkError,
        'Error thrown by save() was not a link error.',
      );
      t.same(e.errors.length, 1, 'LinkError contained too many error items');
      t.same(e.errors[0].parent, user, 'LinkError parent was not user.');
      t.same(e.errors[0].child, comment, 'LinkError child was not comment.');
      t.ok(
        e.errors[0].error instanceof nohm.ValidationError,
        'LinkError contained error was not ValidationError.',
      );
      redis.sismember(
        relationsprefix +
          comment3.modelName +
          ':defaultForeign:' +
          user.modelName +
          ':' +
          comment3.id,
        user.id,
        function(err, value) {
          t.ok(!err, 'There was a redis error');
          t.same(value, '1', 'The comment3 relation was not saved');
          t.done();
        },
      );
    }
  },
};

/* Maybe this isn't such a good idea. I like that model definitions are completely
   lacking relation definitions.
cascadingDeletes: function (t) {
  var user = new UserLinkMockup(),
  role = new RoleLinkMockup(),
  comment = new CommentLinkMockup(),
  testComment = new CommentLinkMockup();
  t.expect(1);

  user.link(role);
  role.link(comment);

  user.save(function (err) {
    if (err) {
      console.dir(err);
      t.done();
    }
    var testid = comment.id;
    user.remove(function (err) {
      if (err) {
        console.dir(err);
        t.done();
      }
      testComment.load(testid, function (err) {
        t.equals(err, 'not found', 'Removing an object that has cascading deletes did not remove the relations');
        t.done();
      });
    });
  });
};*/
