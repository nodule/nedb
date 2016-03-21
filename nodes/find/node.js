on.input.in = function() {
  $.db.find($.in, function(err, newDoc) {
    if(err) {
      output({error: $.create(err)});
    } else {
      output({out: $.create(newDoc)});
    }
  });
};
