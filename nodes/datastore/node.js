output = function() {
  var db = new nedb($.options);
  db.loadDatabase(function(err) {
    if (err) {
      cb({error: $.create(err)});
    } else {
      cb({db: $.create(db)});
    }
  });
};
