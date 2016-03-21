on.input.in = function() {
  $.db.insert($.in, function(err, newDoc) {
    if(err) {
      output({error: err});
    } else {
      output({out: newDoc});
    }
  });
};
