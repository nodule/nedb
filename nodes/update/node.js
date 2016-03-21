output = function() {
  $.db.update($.query, $.update, $.options,
    function(err, numReplaced, newDoc) {
    if(err) {
      output({error: $.create(err)});
    } else {
      output({out: $.create(newDoc), numReplaced: $.create(numReplaced)});
    }
  });
};
