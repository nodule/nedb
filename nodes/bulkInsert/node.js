on.input.in = function() {
  $.db.insert($.in, function(err, newDoc) {
    if(err) {
      output({error: $.create(err)});
    } else {
      output({out: $.create(newDoc)});
    }
  });
};
