on.input.in = function() {
  $.db.count($.in, function(err, newDoc) {
    if(err) {
      output({error: $.create(err)});
    } else {
      output({out: $.create(newDoc)});
    }
  });
};
